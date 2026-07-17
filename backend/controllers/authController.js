const crypto = require("crypto");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { uploadBuffer, deleteFile } = require("../services/cloudinaryService");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.cookie("token", token, COOKIE_OPTIONS);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = generateToken(user._id);
    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie("token");
  res.json({ success: true, message: "Logged out" });
}

async function getMe(req, res) {
  const { _id, name, email, role, avatarUrl } = req.user;
  res.json({ success: true, user: { id: _id, name, email, role, avatarUrl } });
}

async function updateProfile(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    req.user.name = name.trim();
    await req.user.save();

    const { _id, email, role, avatarUrl } = req.user;
    res.json({ success: true, user: { id: _id, name: req.user.name, email, role, avatarUrl } });
  } catch (err) {
    next(err);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    // avatarPublicId is select:false on the schema, so req.user (loaded by
    // authMiddleware) won't have it — fetch it explicitly here so we can
    // clean up the previous avatar after the new one is uploaded.
    const user = await User.findById(req.user._id).select("+avatarPublicId");

    const storedName = crypto.randomBytes(16).toString("hex");
    const result = await uploadBuffer(req.file.buffer, {
      publicId: storedName,
      folder: "aura-avatars",
      resourceType: "image",
    });

    const previousPublicId = user.avatarPublicId;
    user.avatarUrl = result.secure_url;
    user.avatarPublicId = result.public_id;
    await user.save();

    if (previousPublicId) {
      deleteFile(previousPublicId, "image").catch(() => {});
    }

    res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword; // pre-save hook re-hashes it
    await user.save();

    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, getMe, updateProfile, uploadAvatar, changePassword };
