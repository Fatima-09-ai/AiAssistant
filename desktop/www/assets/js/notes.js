let activeTab = "notes";

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  const user = getCurrentUser();
  if (user) document.getElementById("user-label").textContent = user.name || user.email;

  document.getElementById("logout-btn").addEventListener("click", () => {
    api.logout().catch(() => {});
    logoutUser();
  });

  document.querySelectorAll(".notes-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("note-form").addEventListener("submit", handleCreateNote);
  document.getElementById("todo-form").addEventListener("submit", handleCreateTodo);

  loadNotes();
  loadTodos();
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".notes-tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  document.getElementById("notes-panel").hidden = tab !== "notes";
  document.getElementById("todos-panel").hidden = tab !== "todos";
}

/* ---------------- Notes ---------------- */

async function loadNotes() {
  try {
    const { notes } = await api.listNotes();
    renderNotes(notes);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderNotes(notes) {
  const grid = document.getElementById("notes-grid");
  grid.innerHTML = "";

  if (!notes.length) {
    grid.innerHTML = `<div class="empty-hint">No notes yet — add one above.</div>`;
    return;
  }

  for (const note of notes) {
    const card = document.createElement("div");
    card.className = "note-card";
    if (note.pinned) card.classList.add("pinned");

    const titleEl = document.createElement("div");
    titleEl.className = "note-title";
    titleEl.contentEditable = "true";
    titleEl.textContent = note.title;

    const contentEl = document.createElement("div");
    contentEl.className = "note-content";
    contentEl.contentEditable = "true";
    contentEl.textContent = note.content;

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "icon-btn";
    pinBtn.title = note.pinned ? "Unpin" : "Pin";
    pinBtn.textContent = note.pinned ? "📌" : "📍";
    pinBtn.addEventListener("click", async () => {
      try {
        await api.updateNote(note._id, { pinned: !note.pinned });
        loadNotes();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.title = "Delete";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this note?")) return;
      try {
        await api.deleteNote(note._id);
        loadNotes();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // Save on blur (either field), debounced by just firing on blur — no
    // need for a dedicated save button for a lightweight notes widget.
    const saveEdit = async () => {
      try {
        await api.updateNote(note._id, { title: titleEl.textContent, content: contentEl.textContent });
      } catch (err) {
        showToast(err.message, "error");
      }
    };
    titleEl.addEventListener("blur", saveEdit);
    contentEl.addEventListener("blur", saveEdit);

    actions.appendChild(pinBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(titleEl);
    card.appendChild(contentEl);
    card.appendChild(actions);
    grid.appendChild(card);
  }
}

async function handleCreateNote(e) {
  e.preventDefault();
  const titleInput = document.getElementById("note-title-input");
  const contentInput = document.getElementById("note-content-input");
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  if (!title && !content) return;

  try {
    await api.createNote(title, content);
    titleInput.value = "";
    contentInput.value = "";
    loadNotes();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* ---------------- Todos ---------------- */

async function loadTodos() {
  try {
    const { todos } = await api.listTodos();
    renderTodos(todos);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function formatDueDate(dueDate) {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  const today = new Date();
  const isOverdue = d < new Date(today.toDateString()) ;
  const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `<span class="todo-due ${isOverdue ? "overdue" : ""}">${label}</span>`;
}

function renderTodos(todos) {
  const list = document.getElementById("todos-list");
  list.innerHTML = "";

  if (!todos.length) {
    list.innerHTML = `<div class="empty-hint">No todos yet — add one above.</div>`;
    return;
  }

  for (const todo of todos) {
    const row = document.createElement("div");
    row.className = "todo-row";
    if (todo.completed) row.classList.add("completed");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", async () => {
      try {
        await api.updateTodo(todo._id, { completed: checkbox.checked });
        loadTodos();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    const textEl = document.createElement("span");
    textEl.className = "todo-text";
    textEl.contentEditable = "true";
    textEl.textContent = todo.text;
    textEl.addEventListener("blur", async () => {
      const newText = textEl.textContent.trim();
      if (!newText || newText === todo.text) {
        textEl.textContent = todo.text;
        return;
      }
      try {
        await api.updateTodo(todo._id, { text: newText });
      } catch (err) {
        showToast(err.message, "error");
        textEl.textContent = todo.text;
      }
    });

    const dueEl = document.createElement("span");
    dueEl.innerHTML = formatDueDate(todo.dueDate);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.title = "Delete";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", async () => {
      try {
        await api.deleteTodo(todo._id);
        loadTodos();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    row.appendChild(checkbox);
    row.appendChild(textEl);
    row.appendChild(dueEl);
    row.appendChild(deleteBtn);
    list.appendChild(row);
  }
}

async function handleCreateTodo(e) {
  e.preventDefault();
  const textInput = document.getElementById("todo-text-input");
  const dateInput = document.getElementById("todo-date-input");
  const text = textInput.value.trim();
  if (!text) return;

  try {
    await api.createTodo(text, dateInput.value || undefined);
    textInput.value = "";
    dateInput.value = "";
    loadTodos();
  } catch (err) {
    showToast(err.message, "error");
  }
}
