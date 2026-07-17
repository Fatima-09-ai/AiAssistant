const express = require("express");
const router = express.Router();
const { register, login, logout, getMe, updateProfile, uploadAvatar, changePassword } = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const { avatarUpload } = require("../middlewares/uploadMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateProfile);
router.post("/me/avatar", protect, avatarUpload.single("avatar"), uploadAvatar);
router.patch("/me/password", protect, changePassword);

module.exports = router;
