const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true }, // our own random id (avoids collisions/guessing); also used as the Cloudinary public_id
    cloudinaryPublicId: { type: String, required: true }, // full Cloudinary public_id, needed to delete the file later
    cloudinaryUrl: { type: String, required: true }, // actual Cloudinary secure_url, fetched server-side when proxying the file back
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ["image", "document"], required: true },
    url: { type: String, required: true }, // AURA's own attachment endpoint, e.g. /api/chat/attachments/<storedName>
    extractedText: { type: String, default: "" }, // documents only — cached so later turns keep context
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    attachments: { type: [attachmentSchema], default: undefined },
    model: { type: String, default: undefined }, // assistant messages only — which Groq model answered
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
