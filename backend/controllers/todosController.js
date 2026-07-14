const Todo = require("../models/Todo");

// GET /api/todos
async function listTodos(req, res, next) {
  try {
    const todos = await Todo.find({ user: req.user._id }).sort({ completed: 1, createdAt: -1 });
    res.json({ success: true, todos });
  } catch (err) {
    next(err);
  }
}

// POST /api/todos  { text, dueDate? }
async function createTodo(req, res, next) {
  try {
    const { text, dueDate } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Todo text is required" });
    }
    const todo = await Todo.create({
      user: req.user._id,
      text: text.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    res.status(201).json({ success: true, todo });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/todos/:id  { text?, completed?, dueDate? }
async function updateTodo(req, res, next) {
  try {
    const { text, completed, dueDate } = req.body;
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    if (!todo) return res.status(404).json({ success: false, message: "Todo not found" });

    if (text !== undefined) {
      if (!text.trim()) return res.status(400).json({ success: false, message: "Todo text can't be empty" });
      todo.text = text.trim();
    }
    if (completed !== undefined) todo.completed = Boolean(completed);
    if (dueDate !== undefined) todo.dueDate = dueDate ? new Date(dueDate) : null;

    await todo.save();
    res.json({ success: true, todo });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/todos/:id
async function deleteTodo(req, res, next) {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!todo) return res.status(404).json({ success: false, message: "Todo not found" });
    res.json({ success: true, message: "Todo deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = { listTodos, createTodo, updateTodo, deleteTodo };
