const express = require("express");
const router = express.Router();
const { getStats, listUsers, updateUserRole, deleteUser } = require("../controllers/adminController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

router.use(protect, adminOnly);

router.get("/stats", getStats);
router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

module.exports = router;
