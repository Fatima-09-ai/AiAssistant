const express = require("express");
const router = express.Router();
const { listTodos, createTodo, updateTodo, deleteTodo } = require("../controllers/todosController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/", listTodos);
router.post("/", createTodo);
router.patch("/:id", updateTodo);
router.delete("/:id", deleteTodo);

module.exports = router;
