const Memory = require("../models/Memory");

/**
 * Fetches stored facts about a user and turns them into a system prompt
 * that gets prepended to every Groq call, so AURA "remembers" the user.
 */
async function buildSystemPrompt(userId, userName) {
  const memories = await Memory.find({ user: userId }).sort({ createdAt: -1 }).limit(30);

  let prompt = `You are AURA, a helpful, warm, concise AI assistant. The user's name is ${userName}.`;

  if (memories.length > 0) {
    const facts = memories.map((m) => `- ${m.fact}`).join("\n");
    prompt += `\n\nHere are things you know about this user from past conversations:\n${facts}\n\nUse this context naturally when relevant, but don't force it into every reply.`;
  }

  return prompt;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const EXTRACTOR_MODEL = process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b";

const EXTRACTOR_SYSTEM_PROMPT = `You extract durable personal facts about a user from one chat message, for a long-term memory feature.

Only include facts that are:
- Explicitly stated by the user (never inferred or guessed)
- Durable (name, location, job/role, ongoing projects, relationships, preferences, skills) — not one-off or transient (today's mood, this specific question, the current task)

Respond with ONLY compact JSON, no markdown, no commentary, in this exact shape:
{"facts": ["fact one", "fact two"]}

If there is nothing worth remembering, respond with {"facts": []}. Extract at most 3 facts. Each fact should be a short, self-contained sentence written in third person (e.g. "Lives in Austin, TX", "Works as a nurse", "Prefers dark mode").`;

/**
 * Skips the LLM call entirely for messages too short/generic to plausibly
 * contain a durable fact — keeps this cheap for everyday chat turns.
 */
function looksExtractable(message) {
  return message.trim().split(/\s+/).length >= 4;
}

/**
 * Asks a fast Groq model to pull out any durable facts from the message.
 * Returns a string[] (possibly empty). Never throws — callers treat memory
 * extraction as best-effort and shouldn't fail a chat turn over it.
 */
async function extractFacts(userMessage) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EXTRACTOR_MODEL,
      messages: [
        { role: "system", content: EXTRACTOR_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });

  if (!response.ok) throw new Error(`Groq extractor error (${response.status})`);

  const data = await response.json();
  const raw = (data?.choices?.[0]?.message?.content || "").trim();
  // Strip ```json fences in case the model adds them despite instructions.
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed?.facts)) return [];
  return parsed.facts.filter((f) => typeof f === "string" && f.trim()).slice(0, 3);
}

/**
 * Extracts durable facts from a message via Groq and stores any that aren't
 * already saved for this user (case-insensitive substring match, so "Lives
 * in Austin" won't be re-saved as "Lives in Austin, TX" and vice versa isn't
 * checked too aggressively — good enough without a fuzzy-match library).
 */
async function maybeStoreFact(userId, userMessage) {
  if (!looksExtractable(userMessage)) return;

  const facts = await extractFacts(userMessage);
  if (!facts.length) return;

  const existing = await Memory.find({ user: userId }).select("fact").lean();
  const existingLower = existing.map((m) => m.fact.toLowerCase());

  for (const fact of facts) {
    const alreadyKnown = existingLower.some(
      (e) => e.includes(fact.toLowerCase()) || fact.toLowerCase().includes(e)
    );
    if (alreadyKnown) continue;
    await Memory.create({ user: userId, fact, source: "chat" });
    existingLower.push(fact.toLowerCase());
  }
}

module.exports = { buildSystemPrompt, maybeStoreFact };
