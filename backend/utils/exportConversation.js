const PDFDocument = require("pdfkit");

/**
 * Builds a plain-text transcript of a conversation.
 * @param {{title: string, createdAt: Date}} conversation
 * @param {Array<{role: string, content: string, createdAt: Date}>} messages
 * @returns {string}
 */
function generateTxt(conversation, messages) {
  const lines = [];
  lines.push(`AURA — ${conversation.title}`);
  lines.push(`Exported: ${new Date().toLocaleString()}`);
  lines.push("=".repeat(50));
  lines.push("");

  for (const m of messages) {
    const speaker = m.role === "user" ? "You" : "AURA";
    const time = new Date(m.createdAt).toLocaleString();
    lines.push(`[${time}] ${speaker}:`);
    lines.push(m.content);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Streams a PDF transcript of a conversation directly to an Express response.
 * @param {import('express').Response} res
 * @param {{title: string}} conversation
 * @param {Array<{role: string, content: string, createdAt: Date}>} messages
 */
function streamPdf(res, conversation, messages) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(res);

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("AURA", { continued: false });
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#666666")
    .text(conversation.title)
    .text(`Exported ${new Date().toLocaleString()}`)
    .moveDown(1);

  doc
    .strokeColor("#dddddd")
    .moveTo(doc.x, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown(1);

  for (const m of messages) {
    const speaker = m.role === "user" ? "You" : "AURA";
    const time = new Date(m.createdAt).toLocaleString();

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(m.role === "user" ? "#0f766e" : "#7c3aed")
      .text(`${speaker}  ·  ${time}`);

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#111111")
      .text(m.content, { paragraphGap: 4 })
      .moveDown(0.8);
  }

  doc.end();
}

module.exports = { generateTxt, streamPdf };
