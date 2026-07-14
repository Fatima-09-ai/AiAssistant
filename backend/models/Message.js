const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true }, // filename on disk (random, avoids collisions/guessing)
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ["image", "document"], required: true },
    url: { type: String, required: true }, // path AURA served it back at, e.g. /uploads/<file>
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
