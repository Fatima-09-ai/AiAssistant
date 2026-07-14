const express = require("express");
const router = express.Router();
const { listNotes, createNote, updateNote, deleteNote } = require("../controllers/notesController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/", listNotes);
router.post("/", createNote);
router.patch("/:id", updateNote);
router.delete("/:id", deleteNote);

module.exports = router;
