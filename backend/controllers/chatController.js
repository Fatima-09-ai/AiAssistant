const fs = require("fs/promises");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { generateReply } = require("../services/groqService");
const { buildSystemPrompt, maybeStoreFact } = require("../services/memoryService");
const { generateTxt, streamPdf } = require("../utils/exportConversation");
const { extractText, toImageDataUrl } = require("../utils/fileProcessor");
const { ALLOWED_TYPES } = require("../middlewares/uploadMiddleware");

/**
 * Turns a multer file into the attachment record we save on the Message,
 * pulling out document text now (so future turns can still "see" it even
 * though we won't resend the raw file to Groq again).
 */
async function buildAttachment(file) {
  const kind = ALLOWED_TYPES[file.mimetype];
  const attachment = {
    originalName: file.originalname,
    storedName: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    kind,
    url: `/uploads/${file.filename}`,
  };
  if (kind === "document") {
    attachment.extractedText = await extractText(file.path, file.mimetype);
  }
  return attachment;
}

/**
 * Converts one stored Message into the {role, content} (or multimodal
 * content array) shape Groq expects. `liveImageDataUrl` is only set for the
 * message currently being sent — we don't re-read and resend older images
 * from disk on every subsequent turn, that gets expensive fast.
 */
function toGroqMessage(messageDoc, liveImageDataUrl) {
  const attachments = messageDoc.attachments || [];
  const docNotes = attachments
    .filter((a) => a.kind === "document" && a.extractedText)
    .map((a) => `\n\n[Content of attached file "${a.originalName}"]:\n${a.extractedText}`)
    .join("");

  const baseText = `${messageDoc.content}${docNotes}`;

  const imageAttachment = attachments.find((a) => a.kind === "image");
  if (imageAttachment && liveImageDataUrl) {
    return {
      role: messageDoc.role,
      content: [
        { type: "text", text: baseText || "What's in this file?" },
        { type: "image_url", image_url: { url: liveImageDataUrl } },
      ],
    };
  }
  if (imageAttachment) {
    // Older turn, image bytes not resent — just note it was there.
    return { role: messageDoc.role, content: `${baseText}\n\n[Image attached: ${imageAttachment.originalName}]` };
  }

  return { role: messageDoc.role, content: baseText };
}

// GET /api/chat/conversations
async function listConversations(req, res, next) {
  try {
    const conversations = await Conversation.find({ user: req.user._id }).sort({ lastMessageAt: -1 });
    res.json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/chat/conversations/:id  { title }
async function renameConversation(req, res, next) {
  try {
    const title = (req.body.title || "").trim();
    if (!title) {
      return res.status(400).json({ success: false, message: "Title can't be empty" });
    }
    if (title.length > 60) {
      return res.status(400).json({ success: false, message: "Title must be 60 characters or fewer" });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    conversation.title = title;
    await conversation.save();

    res.json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/conversations/:id/messages
async function getMessages(req, res, next) {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 });
    res.json({ success: true, conversation, messages });
  } catch (err) {
    next(err);
  }
}

// POST /api/chat/message  multipart/form-data: { conversationId?, message?, file?, model? }
// `message` and `file` are each optional, but at least one is required.
// `model` is "smart" (default, better reasoning) or "fast" (quicker); an
// image attachment always overrides this and uses the vision model instead.
async function sendMessage(req, res, next) {
  try {
    const message = (req.body.message || "").trim();
    let { conversationId } = req.body;
    const file = req.file;
    const modelChoice = req.body.model === "fast" ? "fast" : "smart";

    if (!message && !file) {
      return res.status(400).json({ success: false, message: "Message text or a file is required" });
    }

    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ _id: conversationId, user: req.user._id });
      if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    } else {
      conversation = await Conversation.create({
        user: req.user._id,
        title: (message || file.originalname).slice(0, 40),
      });
      conversationId = conversation._id;
    }

    // Build attachment metadata (and extract document text) before saving
    let attachment;
    if (file) {
      try {
        attachment = await buildAttachment(file);
      } catch (err) {
        await fs.unlink(file.path).catch(() => {});
        throw err;
      }
    }

    // Save user message
    const userMessageContent = message || `Uploaded ${file.originalname}`;
    const userMessage = await Message.create({
      conversation: conversationId,
      user: req.user._id,
      role: "user",
      content: userMessageContent,
      attachments: attachment ? [attachment] : undefined,
    });

    // Build recent history (last 20 messages) for context
    const recentMessages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: -1 })
      .limit(20);
    const ordered = recentMessages.reverse();

    // Only the message we just created gets the live (freshly-read) image
    // data — see toGroqMessage for why older image turns aren't resent.
    let liveImageDataUrl;
    const hasImage = attachment?.kind === "image";
    if (hasImage) {
      liveImageDataUrl = await toImageDataUrl(file.path, file.mimetype);
    }

    const history = ordered.map((m) =>
      toGroqMessage(m, m._id.equals(userMessage._id) ? liveImageDataUrl : undefined)
    );

    const systemPrompt = await buildSystemPrompt(req.user._id, req.user.name);
    const { text: replyText, model: modelUsed } = await generateReply(history, systemPrompt, { hasImage, modelChoice });

    // Save assistant reply
    const assistantMessage = await Message.create({
      conversation: conversationId,
      user: req.user._id,
      role: "assistant",
      content: replyText,
      model: modelUsed,
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Fire-and-forget fact extraction (don't block the response on it)
    if (message) {
      maybeStoreFact(req.user._id, message).catch((e) => console.error("Memory extraction failed:", e.message));
    }

    res.json({
      success: true,
      conversationId,
      userMessage: {
        role: "user",
        content: userMessageContent,
        attachments: userMessage.attachments,
        createdAt: userMessage.createdAt,
      },
      reply: { role: "assistant", content: replyText, model: modelUsed, createdAt: assistantMessage.createdAt },
    });
  } catch (err) {
    next(err);
  }

}

// DELETE /api/chat/conversations/:id
async function deleteConversation(req, res, next) {
  try {
    const conversation = await Conversation.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    const messages = await Message.find({ conversation: conversation._id });
    await Message.deleteMany({ conversation: conversation._id });

    // Clean up any uploaded files so they don't pile up on disk
    const { UPLOAD_DIR } = require("../middlewares/uploadMiddleware");
    const path = require("path");
    const filesToRemove = messages.flatMap((m) => (m.attachments || []).map((a) => path.join(UPLOAD_DIR, a.storedName)));
    await Promise.all(filesToRemove.map((p) => fs.unlink(p).catch(() => {})));

    res.json({ success: true, message: "Conversation deleted" });
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/conversations/:id/export?format=pdf|txt
async function exportConversation(req, res, next) {
  try {
    const format = (req.query.format || "txt").toLowerCase();
    if (!["txt", "pdf"].includes(format)) {
      return res.status(400).json({ success: false, message: "format must be 'txt' or 'pdf'" });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 });

    const safeTitle = conversation.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "conversation";

    if (format === "txt") {
      const text = generateTxt(conversation, messages);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="aura-${safeTitle}.txt"`);
      return res.send(text);
    }

    // PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="aura-${safeTitle}.pdf"`);
    streamPdf(res, conversation, messages);
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/attachments/:filename
// Deliberately not a plain express.static mount on /uploads — that would let
// anyone with a link view any user's file. This checks the filename actually
// belongs to one of the requesting user's own messages first.
async function getAttachment(req, res, next) {
  try {
    const { filename } = req.params;
    const message = await Message.findOne({
      user: req.user._id,
      "attachments.storedName": filename,
    });
    if (!message) return res.status(404).json({ success: false, message: "File not found" });

    const attachment = message.attachments.find((a) => a.storedName === filename);
    const { UPLOAD_DIR } = require("../middlewares/uploadMiddleware");
    const path = require("path");
    res.type(attachment.mimetype);
    res.sendFile(path.join(UPLOAD_DIR, filename));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listConversations,
  renameConversation,
  getMessages,
  sendMessage,
  deleteConversation,
  exportConversation,
  getAttachment,
};
