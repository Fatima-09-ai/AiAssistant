const Memory = require("../models/Memory");

async function listMemories(req, res, next) {
  try {
    const memories = await Memory.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, memories });
  } catch (err) {
    next(err);
  }
}

async function deleteMemory(req, res, next) {
  try {
    const memory = await Memory.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!memory) {
      return res.status(404).json({ success: false, message: "Memory not found" });
    }
    res.json({ success: true, message: "Memory deleted" });
  } catch (err) {
    next(err);
  }
}

async function deleteAllMemories(req, res, next) {
  try {
    await Memory.deleteMany({ user: req.user._id });
    res.json({ success: true, message: "All memories deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMemories, deleteMemory, deleteAllMemories };
