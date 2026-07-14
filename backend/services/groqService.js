/**
 * Wrapper around Groq's OpenAI-compatible chat completions API.
 * Docs: https://console.groq.com/docs
 *
 * Groq's free tier requires no credit card and (unlike Gemini's free tier)
 * isn't reported to have regional gating. Rate limits are modest but fine
 * for prototyping — see https://console.groq.com/docs/rate-limits for current numbers.
 *
 * Model note: llama-3.3-70b-versatile (the model this project originally used)
 * was deprecated by Groq in June 2026. openai/gpt-oss-120b is the current
 * general-purpose replacement. For requests that include an image, a
 * vision-capable model is required instead — qwen/qwen3.6-27b as of this
 * writing, though Groq's multimodal lineup changes often, so check
 * https://console.groq.com/docs/models if this stops working.
 *
 * Two text models are offered so the person can trade quality for speed:
 * "smart" (120B, better reasoning) and "fast" (20B, noticeably quicker,
 * still solid for everyday chat). Both are Groq's own current models, so no
 * extra API key or provider is needed.
 */

const TEXT_MODELS = {
  smart: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  fast: process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b",
};
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * @param {Array<{role: "user"|"assistant", content: string|Array}>} history
 *   `content` is normally a plain string. For a message with an image
 *   attachment, `content` is an array of Groq "content parts", e.g.
 *   [{ type: "text", text: "..." }, { type: "image_url", image_url: { url: "data:..." } }]
 * @param {string} systemPrompt
 * @param {{ hasImage?: boolean, modelChoice?: "smart"|"fast" }} options
 *   hasImage forces the vision model regardless of modelChoice (neither text
 *   model can see images). modelChoice defaults to "smart" for anything
 *   invalid/unrecognized.
 * @returns {Promise<{ text: string, model: string }>}
 */
async function generateReply(history, systemPrompt = "", { hasImage = false, modelChoice = "smart" } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env");

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const model = hasImage ? GROQ_VISION_MODEL : TEXT_MODELS[modelChoice] || TEXT_MODELS.smart;

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";

  if (!text) throw new Error("Groq returned an empty response");
  return { text: text.trim(), model };
}

module.exports = { generateReply, TEXT_MODELS };
