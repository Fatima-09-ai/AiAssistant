const mammoth = require("mammoth");

// How much extracted text we're willing to stuff into a single prompt.
// Groq's context window is generous but not infinite, and huge documents
// would blow the token budget and cost — so a large file gets truncated
// with a note rather than silently failing.
const MAX_EXTRACTED_CHARS = 12000;

function truncate(text) {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[...truncated — document is longer than what could be included...]`;
}

/**
 * Pulls plain text out of a document attachment so it can be dropped into
 * the prompt as context. Works directly off the in-memory Buffer multer
 * gives us (no disk path — see uploadMiddleware) so this works the same in
 * serverless as it did locally. Returns "" (not a throw) on failure so a
 * single unreadable file doesn't take down the whole chat request.
 */
async function extractText(buffer, mimetype) {
  try {
    if (mimetype === "application/pdf") {
      const { PDFParse } = require("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return truncate((result.text || "").trim());
    }

    if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const { value } = await mammoth.extractRawText({ buffer });
      return truncate((value || "").trim());
    }

    if (mimetype === "text/plain" || mimetype === "text/csv" || mimetype === "text/markdown") {
      return truncate(buffer.toString("utf-8").trim());
    }

    return "";
  } catch (err) {
    console.error(`Failed to extract text from buffer (${mimetype}):`, err.message);
    return "";
  }
}

/**
 * Builds a base64 data URL for an image attachment, the format Groq's
 * vision models expect for inline (as opposed to hosted-URL) images.
 */
function toImageDataUrl(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString("base64")}`;
}

module.exports = { extractText, toImageDataUrl, MAX_EXTRACTED_CHARS };
