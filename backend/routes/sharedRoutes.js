const express = require("express");
const router = express.Router();
const { getSharedConversation } = require("../controllers/chatController");

// Deliberately NOT behind the `protect` middleware — this is what makes a
// share link work for someone who isn't logged in (or doesn't even have an
// account).
router.get("/:token", getSharedConversation);

module.exports = router;
