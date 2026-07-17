const express = require("express");
const router = express.Router();
const { listMemories, deleteMemory, deleteAllMemories } = require("../controllers/memoryController");
const { protect } = require("../middlewares/authMiddleware");

router.get("/", protect, listMemories);
router.delete("/:id", protect, deleteMemory);
router.delete("/", protect, deleteAllMemories);

module.exports = router;
