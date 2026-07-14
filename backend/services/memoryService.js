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

/**
 * Very simple heuristic fact-extractor: looks for sentences that sound like
 * durable personal facts ("I live in...", "My name is...", "I work as...").
 * Swap this for a Groq-based extraction call later if you want it smarter.
 */
async function maybeStoreFact(userId, userMessage) {
  const patterns = [
    /\bmy name is ([^.,!?]+)/i,
    /\bi live in ([^.,!?]+)/i,
    /\bi work as ([^.,!?]+)/i,
    /\bi am (a|an) ([^.,!?]+)/i,
    /\bi like ([^.,!?]+)/i,
    /\bmy favorite ([^.,!?]+)/i,
  ];

  for (const pattern of patterns) {
    const match = userMessage.match(pattern);
    if (match) {
      await Memory.create({ user: userId, fact: match[0].trim(), source: "chat" });
      break; // one fact per message keeps it simple
    }
  }
}

module.exports = { buildSystemPrompt, maybeStoreFact };
