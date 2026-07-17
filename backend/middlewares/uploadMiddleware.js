const multer = require("multer");

// mimetype -> "image" | "document", used both to validate the upload and to
// decide later whether AURA should look at it with the vision model or just
// read the extracted text.
const ALLOWED_TYPES = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document", // .docx
  "text/plain": "document",
  "text/csv": "document",
  "text/markdown": "document",
};

// Memory storage — the file lives only as a Buffer on req.file.buffer, never
// written to disk. Vercel's serverless functions have a read-only
// filesystem (aside from /tmp, which is wiped between invocations anyway),
// so disk storage silently fails there. The buffer gets uploaded straight
// to Cloudinary right after (see chatController.buildAttachment).
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES[file.mimetype]) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// Separate instance for profile avatars — images only, smaller cap. Keeping
// it distinct from the chat `upload` above means a stricter/looser limit
// here never has to touch chat attachment behavior.
const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const avatarUpload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!AVATAR_TYPES.has(file.mimetype)) {
      return cb(new Error(`Unsupported image type: ${file.mimetype}`));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = { upload, avatarUpload, ALLOWED_TYPES };
