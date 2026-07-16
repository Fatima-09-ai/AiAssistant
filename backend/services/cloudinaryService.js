const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads a Buffer (from multer memoryStorage) straight to Cloudinary
 * without ever touching disk — this is what makes uploads work on Vercel's
 * serverless functions, where the filesystem is read-only outside /tmp.
 *
 * `publicId` should be a random id we generate ourselves (see
 * uploadMiddleware/chatController) rather than the original filename, for
 * the same reason the old disk storage never trusted the original name:
 * it avoids collisions and stops one user guessing another user's file URL.
 */
function uploadBuffer(buffer, { publicId, folder = "aura-uploads", resourceType = "raw" } = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType, // "image" for images, "raw" for pdf/docx/txt/csv
        folder,
        public_id: publicId,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Deletes a previously-uploaded file. resourceType must match what it was
 * uploaded with ("image" vs "raw") or Cloudinary won't find it.
 */
function deleteFile(publicId, resourceType = "raw") {
  if (!publicId) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = { uploadBuffer, deleteFile, cloudinary };
