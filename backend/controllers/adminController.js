const fs = require("fs/promises");
const path = require("path");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Note = require("../models/Note");
const Todo = require("../models/Todo");
const Memory = require("../models/Memory");
const { UPLOAD_DIR } = require("../middlewares/uploadMiddleware");

// GET /api/admin/stats
async function getStats(req, res, next) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, newUsersThisWeek, totalConversations, totalMessages, totalNotes, totalTodos] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: weekAgo } }),
        Conversation.countDocuments(),
        Message.countDocuments(),
        Note.countDocuments(),
        Todo.countDocuments(),
      ]);

    res.json({
      success: true,
      stats: { totalUsers, newUsersThisWeek, totalConversations, totalMessages, totalNotes, totalTodos },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/users
async function listUsers(req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();

    // Per-user conversation counts in one aggregation instead of N queries
    const counts = await Conversation.aggregate([{ $group: { _id: "$user", count: { $sum: 1 } } }]);
    const countByUser = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

    const withCounts = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      conversationCount: countByUser[String(u._id)] || 0,
    }));

    res.json({ success: true, users: withCounts });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/users/:id/role  { role: "user" | "admin" }
async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be "user" or "admin"' });
    }
    if (req.params.id === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You can't change your own role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.role = role;
    await user.save();

    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/users/:id — cascades to everything the user owns
async function deleteUser(req, res, next) {
  try {
    if (req.params.id === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You can't delete your own account here" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const conversations = await Conversation.find({ user: user._id }).select("_id");
    const conversationIds = conversations.map((c) => c._id);

    const messages = await Message.find({ conversation: { $in: conversationIds } });
    const filesToRemove = messages.flatMap((m) => (m.attachments || []).map((a) => path.join(UPLOAD_DIR, a.storedName)));

    await Promise.all([
      Message.deleteMany({ conversation: { $in: conversationIds } }),
      Conversation.deleteMany({ user: user._id }),
      Note.deleteMany({ user: user._id }),
      Todo.deleteMany({ user: user._id }),
      Memory.deleteMany({ user: user._id }),
      user.deleteOne(),
      ...filesToRemove.map((p) => fs.unlink(p).catch(() => {})),
    ]);

    res.json({ success: true, message: `${user.email} and all their data were deleted` });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats, listUsers, updateUserRole, deleteUser };
