const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New Chat" },
    lastMessageAt: { type: Date, default: Date.now },
    isShared: { type: Boolean, default: false },
    shareToken: { type: String, unique: true, sparse: true }, // sparse: many conversations can have no token
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
