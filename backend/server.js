require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notesRoutes = require("./routes/notesRoutes");
const todosRoutes = require("./routes/todosRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
app.set("trust proxy", 1);
// --- Core middleware ---
// CLIENT_URL can be a comma-separated list (e.g. multiple deployed frontends).
// Capacitor's native app schemes are allowed by default so the mobile build
// works without extra config; add your deployed backend's real frontend
// origin(s) to CLIENT_URL in .env once you have one.
const allowedOrigins = [
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map((s) => s.trim()) : []),
  "capacitor://localhost",
  "ionic://localhost",
];
// Matches http(s)://localhost, http(s)://127.0.0.1, on ANY port (or no port) —
// covers Express serving the frontend itself (any PORT value), Live Server,
// Vite, etc. during local development.
const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === "null") {
        return callback(null, true);
      }

      if (
        localhostPattern.test(origin) ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      // Allow any Back4App deployment
      if (origin.endsWith(".b4a.run")) {
        return callback(null, true);
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// Basic rate limiting on API routes
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use("/api", apiLimiter);

// --- Health check (register BEFORE broad /api mounts) ---
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok", time: new Date().toISOString() });
});

// --- API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/todos", todosRoutes);
app.use("/api/admin", adminRoutes);

// --- Serve frontend static files ---
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));
app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`AURA server running on http://localhost:${PORT}`));
}

start();
