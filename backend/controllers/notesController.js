const Note = require("../models/Note");

// GET /api/notes
async function listNotes(req, res, next) {
  try {
    const notes = await Note.find({ user: req.user._id }).sort({ pinned: -1, updatedAt: -1 });
    res.json({ success: true, notes });
  } catch (err) {
    next(err);
  }
}

// POST /api/notes  { title?, content? }
async function createNote(req, res, next) {
  try {
    const { title, content } = req.body;
    if ((!title || !title.trim()) && (!content || !content.trim())) {
      return res.status(400).json({ success: false, message: "Note needs a title or some content" });
    }
    const note = await Note.create({
      user: req.user._id,
      title: title && title.trim() ? title.trim() : "Untitled note",
      content: content || "",
    });
    res.status(201).json({ success: true, note });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notes/:id  { title?, content?, pinned? }
async function updateNote(req, res, next) {
  try {
    const { title, content, pinned } = req.body;
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });

    if (title !== undefined) note.title = title.trim() || "Untitled note";
    if (content !== undefined) note.content = content;
    if (pinned !== undefined) note.pinned = Boolean(pinned);

    await note.save();
    res.json({ success: true, note });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notes/:id
async function deleteNote(req, res, next) {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true, message: "Note deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotes, createNote, updateNote, deleteNote };
