const crypto = require("crypto");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { generateReply } = require("../services/groqService");
const { buildSystemPrompt, maybeStoreFact } = require("../services/memoryService");
const { generateTxt, streamPdf } = require("../utils/exportConversation");
const { extractText, toImageDataUrl } = require("../utils/fileProcessor");
const { ALLOWED_TYPES } = require("../middlewares/uploadMiddleware");
const { uploadBuffer, deleteFile } = require("../services/cloudinaryService");

/**
 * Turns a multer (memoryStorage) file into the attachment record we save on
 * the Message. The buffer is uploaded straight to Cloudinary — never
 * written to disk, since that's what breaks on Vercel's serverless
 * functions — and we pull out document text now (so future turns can still
 * "see" it even though we won't resend the raw file to Groq again).
 */
async function buildAttachment(file) {
  const kind = ALLOWED_TYPES[file.mimetype];
  const isImage = kind === "image";
  // We generate this id ourselves (rather than letting Cloudinary name the
  // file) so we control the public_id and can look the attachment back up
  // by a value we already know, the same way the old disk storage used a
  // random on-disk filename.
  const storedName = crypto.randomBytes(16).toString("hex");

  const result = await uploadBuffer(file.buffer, {
    publicId: storedName,
    folder: "aura-uploads",
    resourceType: isImage ? "image" : "raw", // non-image docs (pdf/docx/txt/csv) must be "raw" or Cloudinary won't return the original bytes
  });

  const attachment = {
    originalName: file.originalname,
    storedName,
    cloudinaryPublicId: result.public_id,
    cloudinaryUrl: result.secure_url,
    mimetype: file.mimetype,
    size: file.size,
    kind,
    url: `/api/chat/attachments/${storedName}`,
  };
  if (kind === "document") {
    attachment.extractedText = await extractText(file.buffer, file.mimetype);
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

    // Build attachment metadata (and extract document text) before saving.
    // No disk cleanup needed on failure here — the file only ever exists as
    // an in-memory buffer until it's uploaded to Cloudinary.
    let attachment;
    if (file) {
      attachment = await buildAttachment(file);
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
      liveImageDataUrl = toImageDataUrl(file.buffer, file.mimetype);
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

    // Clean up any uploaded files on Cloudinary so they don't pile up
    const cleanups = messages.flatMap((m) =>
      (m.attachments || []).map((a) =>
        deleteFile(a.cloudinaryPublicId, a.kind === "image" ? "image" : "raw").catch(() => {})
      )
    );
    await Promise.all(cleanups);

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
// Deliberately not a direct link to the Cloudinary URL — that would let
// anyone with a link view any user's file, and the frontend's img/link
// handling expects to hit our own authenticated endpoint (see
// api.attachmentBlobUrl). This checks the file actually belongs to one of
// the requesting user's own messages first, then proxies the bytes back
// from Cloudinary so nothing changes on the client side.
async function getAttachment(req, res, next) {
  try {
    const { filename } = req.params;
    const message = await Message.findOne({
      user: req.user._id,
      "attachments.storedName": filename,
    });
    if (!message) return res.status(404).json({ success: false, message: "File not found" });

    const attachment = message.attachments.find((a) => a.storedName === filename);

    const cloudinaryRes = await fetch(attachment.cloudinaryUrl);
    if (!cloudinaryRes.ok) {
      return res.status(502).json({ success: false, message: "Failed to fetch attachment" });
    }
    const buffer = Buffer.from(await cloudinaryRes.arrayBuffer());
    res.type(attachment.mimetype);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// POST /api/chat/conversations/:id/share — turns sharing on and returns the
// token (reused if this conversation was shared before, so re-sharing
// doesn't invalidate a link someone already has).
async function shareConversation(req, res, next) {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    if (!conversation.shareToken) {
      conversation.shareToken = crypto.randomBytes(12).toString("hex");
    }
    conversation.isShared = true;
    await conversation.save();

    res.json({ success: true, shareToken: conversation.shareToken });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/chat/conversations/:id/share — revokes the link. The token
// itself is left on the record (simplifies re-sharing later) but isShared
// gates every public lookup, so the old link stops working immediately.
async function unshareConversation(req, res, next) {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    conversation.isShared = false;
    await conversation.save();

    res.json({ success: true, message: "Sharing turned off" });
  } catch (err) {
    next(err);
  }
}

// GET /api/shared/:token — public, no auth. Only ever returns something for
// a conversation whose owner currently has sharing turned on.
// Attachments are intentionally omitted from the response: the file-serving
// route requires the owner's login, so a public viewer couldn't load them
// anyway, and this avoids sending broken image links.
async function getSharedConversation(req, res, next) {
  try {
    const conversation = await Conversation.findOne({ shareToken: req.params.token, isShared: true });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "This shared chat isn't available" });
    }

    const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 });

    res.json({
      success: true,
      title: conversation.title,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        hasAttachments: Boolean(m.attachments && m.attachments.length),
        model: m.model,
        createdAt: m.createdAt,
      })),
    });
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
  shareConversation,
  unshareConversation,
  getSharedConversation,
};
