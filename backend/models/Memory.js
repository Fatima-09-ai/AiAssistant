const mongoose = require("mongoose");

const memorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fact: { type: String, required: true },
    source: { type: String, default: "chat" }, // where the fact came from
  },
  { timestamps: true }
);

module.exports = mongoose.model("Memory", memorySchema);
