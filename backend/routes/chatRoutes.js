const express = require("express");
const router = express.Router();
const {
  listConversations,
  renameConversation,
  getMessages,
  sendMessage,
  deleteConversation,
  exportConversation,
  getAttachment,
  shareConversation,
  unshareConversation,
} = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");
const { upload } = require("../middlewares/uploadMiddleware");

router.use(protect);

router.get("/conversations", listConversations);
router.patch("/conversations/:id", renameConversation);
router.get("/conversations/:id/messages", getMessages);
router.get("/conversations/:id/export", exportConversation);
router.post("/conversations/:id/share", shareConversation);
router.delete("/conversations/:id/share", unshareConversation);
router.get("/attachments/:filename", getAttachment);
router.delete("/conversations/:id", deleteConversation);
// upload.single("file") is a no-op when no file is sent, so this route
// still works fine for plain text-only messages.
router.post("/message", upload.single("file"), sendMessage);

module.exports = router;
