const mongoose = require("mongoose");

async function connectDB() {
  // Serverless platforms (Vercel) reuse the same warm process across
  // requests, so skip reconnecting if we're already connected/connecting.
  if (mongoose.connection.readyState !== 0) return;

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set in .env");
    if (require.main === module) process.exit(1);
    throw new Error("MONGO_URI is not set");
  }

  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    if (require.main === module) process.exit(1);
    throw err;
  }
}

module.exports = connectDB;
