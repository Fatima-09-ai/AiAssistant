let currentConversationId = null;
let selectedFile = null;
let selectedModel = localStorage.getItem("aura_model") || "smart";

const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("composer-form");
const inputEl = document.getElementById("message-input");
const micBtn = document.getElementById("mic-btn");
const convListEl = document.getElementById("conversation-list");
const headerMark = document.getElementById("header-mark");
const statusLabel = document.getElementById("status-label");
const exportBtn = document.getElementById("export-btn");
const exportOptions = document.getElementById("export-options");
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");
const attachmentPreviewEl = document.getElementById("attachment-preview");
const modelToggleEl = document.getElementById("model-toggle");

const MAX_FILE_BYTES = 15 * 1024 * 1024; // matches the backend's multer limit

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const user = getCurrentUser();
  const userLabel = document.getElementById("user-label");
  if (userLabel && user) userLabel.textContent = user.name;
  if (user && user.role === "admin") {
    document.getElementById("admin-link").style.display = "block";
  }

  await loadConversations();

  document.getElementById("new-chat-btn").addEventListener("click", () => {
    currentConversationId = null;
    messagesEl.innerHTML = "";
    exportBtn.disabled = true;
    clearSelectedFile();
    renderEmptyState();
  });

  attachBtn.addEventListener("click", () => fileInput.click());

  modelToggleEl.querySelectorAll(".model-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.model === selectedModel);
    btn.addEventListener("click", () => {
      selectedModel = btn.dataset.model;
      localStorage.setItem("aura_model", selectedModel);
      modelToggleEl.querySelectorAll(".model-option").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      showToast("That file is too large (max 15MB).", "error");
      fileInput.value = "";
      return;
    }
    selectedFile = file;
    renderAttachmentPreview();
  });

  document.getElementById("logout-btn").addEventListener("click", logoutUser);

  exportBtn.addEventListener("click", () => {
    if (exportBtn.disabled) return;
    exportOptions.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".export-menu")) exportOptions.classList.remove("open");
  });

  exportOptions.querySelectorAll("button[data-format]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      exportOptions.classList.remove("open");
      if (!currentConversationId) return;
      try {
        const res = await api.exportConversation(currentConversationId, btn.dataset.format);
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="([^"]+)"/);
        const filename = match ? match[1] : `aura-export.${btn.dataset.format}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Downloaded ${filename}`);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text && !selectedFile) return;
    inputEl.value = "";
    await handleSend(text);
  });

  micBtn.addEventListener("click", () => {
    if (!AuraVoice.isSupported()) {
      showToast("Voice input isn't supported in this browser. Try Chrome.", "error");
      return;
    }
    micBtn.classList.add("recording");
    setAuraState("listening");
    AuraVoice.startListening({
      onResult: (transcript) => {
        inputEl.value = transcript;
      },
      onEnd: () => {
        micBtn.classList.remove("recording");
        setAuraState("idle");
      },
      onError: (err) => {
        micBtn.classList.remove("recording");
        setAuraState("idle");
        showToast(`Voice error: ${err}`, "error");
      },
    });
  });

  renderEmptyState();
});

function setAuraState(state) {
  headerMark.classList.remove("listening", "speaking");
  if (state === "listening") {
    headerMark.classList.add("listening");
    statusLabel.textContent = "Listening";
  } else if (state === "speaking") {
    headerMark.classList.add("speaking");
    statusLabel.textContent = "Speaking";
  } else {
    statusLabel.textContent = "Idle";
  }
}

function fileIconFor(mimetype) {
  if (mimetype.startsWith("image/")) return "🖼️";
  if (mimetype === "application/pdf") return "📄";
  if (mimetype.includes("wordprocessingml")) return "📝";
  return "📄";
}

function renderAttachmentPreview() {
  if (!selectedFile) {
    attachmentPreviewEl.hidden = true;
    attachmentPreviewEl.innerHTML = "";
    return;
  }
  attachmentPreviewEl.hidden = false;
  const isImage = selectedFile.type.startsWith("image/");
  const thumb = isImage
    ? `<img src="${URL.createObjectURL(selectedFile)}" alt="" />`
    : `<span class="chip-icon">${fileIconFor(selectedFile.type)}</span>`;

  attachmentPreviewEl.innerHTML = `
    <div class="attachment-chip">
      ${thumb}
      <span>${selectedFile.name}</span>
      <button type="button" class="chip-remove" aria-label="Remove attachment">×</button>
    </div>`;

  attachmentPreviewEl.querySelector(".chip-remove").addEventListener("click", clearSelectedFile);
}

function clearSelectedFile() {
  selectedFile = null;
  fileInput.value = "";
  renderAttachmentPreview();
}

function renderEmptyState() {
  messagesEl.innerHTML = `
    <div class="empty-state">
      <div class="aura-mark">
        <svg viewBox="0 0 40 40" width="40" height="40">
          <defs>
            <linearGradient id="emptyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2dd4bf"/>
              <stop offset="50%" stop-color="#8b7ff5"/>
              <stop offset="100%" stop-color="#f472b6"/>
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="17" fill="none" stroke="url(#emptyGrad)" stroke-width="3"/>
        </svg>
      </div>
      <p>Ask AURA anything, or press the mic to speak.</p>
    </div>`;
}

async function loadConversations() {
  try {
    const { conversations } = await api.listConversations();
    convListEl.innerHTML = "";
    conversations.forEach((c) => {
      const item = document.createElement("div");
      item.className = "conversation-item";
      if (c._id === currentConversationId) item.classList.add("active");

      const titleSpan = document.createElement("span");
      titleSpan.className = "conversation-title";
      titleSpan.textContent = c.title;
      titleSpan.title = "Click to open, double-click to rename";
      titleSpan.addEventListener("click", () => openConversation(c._id, c.title));
      titleSpan.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        startRename(item, titleSpan, c);
      });

      const renameBtn = document.createElement("button");
      renameBtn.className = "conversation-rename";
      renameBtn.setAttribute("aria-label", `Rename "${c.title}"`);
      renameBtn.textContent = "✏️";
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startRename(item, titleSpan, c);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "conversation-delete";
      deleteBtn.setAttribute("aria-label", `Delete "${c.title}"`);
      deleteBtn.textContent = "×";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const confirmed = window.confirm(`Delete "${c.title}"? This can't be undone.`);
        if (!confirmed) return;
        try {
          await api.deleteConversation(c._id);
          if (currentConversationId === c._id) {
            currentConversationId = null;
            renderEmptyState();
          }
          await loadConversations();
          showToast("Conversation deleted");
        } catch (err) {
          showToast(err.message, "error");
        }
      });

      item.appendChild(titleSpan);
      item.appendChild(renameBtn);
      item.appendChild(deleteBtn);
      convListEl.appendChild(item);
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Swaps a conversation's title span for an inline <input>, saves on
// Enter/blur, reverts (no save) on Escape.
function startRename(item, titleSpan, conversation) {
  if (item.querySelector(".conversation-rename-input")) return; // already renaming

  const input = document.createElement("input");
  input.type = "text";
  input.className = "conversation-rename-input";
  input.value = conversation.title;
  input.maxLength = 60;

  titleSpan.replaceWith(input);
  input.focus();
  input.select();

  let settled = false;
  const finish = async (shouldSave) => {
    if (settled) return;
    settled = true;
    const newTitle = input.value.trim();

    if (!shouldSave || !newTitle || newTitle === conversation.title) {
      await loadConversations();
      return;
    }
    try {
      await api.renameConversation(conversation._id, newTitle);
      await loadConversations();
    } catch (err) {
      showToast(err.message, "error");
      await loadConversations();
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

async function openConversation(id, title) {
  currentConversationId = id;
  exportBtn.disabled = false;
  try {
    const { messages } = await api.getMessages(id);
    messagesEl.innerHTML = "";
    for (const m of messages) {
      await appendMessage(m.role, m.content, m.attachments, m.model);
    }
    await loadConversations(); // refresh so the active item highlights correctly
  } catch (err) {
    showToast(err.message, "error");
  }
}

function modelLabel(model) {
  if (!model) return "";
  if (model.includes("120b")) return "✨ Smart";
  if (model.includes("20b")) return "⚡ Fast";
  if (model.includes("qwen")) return "👁️ Vision";
  return "";
}

async function appendMessage(role, content, attachments, modelUsed) {
  const el = document.createElement("div");
  el.className = `message ${role}`;

  if (role === "assistant" && modelUsed) {
    const tag = document.createElement("div");
    tag.className = "message-model-tag";
    tag.textContent = modelLabel(modelUsed);
    if (tag.textContent) el.appendChild(tag);
  }

  if (attachments && attachments.length) {
    for (const a of attachments) {
      const card = document.createElement("div");
      card.className = "message-attachment";
      if (a.kind === "image") {
        try {
          const blobUrl = await api.attachmentBlobUrl(a.url);
          card.innerHTML = `<img src="${blobUrl}" alt="${a.originalName}" />`;
        } catch {
          card.innerHTML = `<span class="file-icon">🖼️</span><span class="file-name">${a.originalName}</span>`;
        }
      } else {
        card.innerHTML = `<span class="file-icon">📄</span><span class="file-name">${a.originalName}</span>`;
      }
      el.appendChild(card);
    }
  }

  if (content) {
    const textEl = document.createElement("div");
    textEl.textContent = content;
    el.appendChild(textEl);
  }

  if (role === "assistant" && content) {
    el.appendChild(makeSpeakButton(content));
  }

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

// A small "speak this reply" button placed under assistant messages.
// Voice output is opt-in per message now, not automatic on every reply.
function makeSpeakButton(content) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "message-speak-btn";
  btn.setAttribute("aria-label", "Read this reply aloud");
  btn.innerHTML = "🔊";

  btn.addEventListener("click", () => {
    if (!("speechSynthesis" in window)) {
      showToast("Voice playback isn't supported in this browser.", "error");
      return;
    }

    // Toggle off if this exact message is already speaking
    if (btn.classList.contains("speaking")) {
      AuraVoice.stopSpeaking();
      btn.classList.remove("speaking");
      btn.innerHTML = "🔊";
      setAuraState("idle");
      return;
    }

    // Reset any other speak button back to its default icon
    document.querySelectorAll(".message-speak-btn.speaking").forEach((b) => {
      b.classList.remove("speaking");
      b.innerHTML = "🔊";
    });

    btn.classList.add("speaking");
    btn.innerHTML = "⏹️";
    setAuraState("speaking");
    AuraVoice.speak(content);

    const estimatedMs = Math.min(20000, content.length * 55);
    setTimeout(() => {
      if (btn.classList.contains("speaking")) {
        btn.classList.remove("speaking");
        btn.innerHTML = "🔊";
        setAuraState("idle");
      }
    }, estimatedMs);
  });

  return btn;
}

// Shows the just-picked local file instantly (no round trip needed) using an
// object URL, since we already have the File in hand.
function appendLocalMessage(role, content, file) {
  const el = document.createElement("div");
  el.className = `message ${role}`;

  if (file) {
    const card = document.createElement("div");
    card.className = "message-attachment";
    if (file.type.startsWith("image/")) {
      card.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="${file.name}" />`;
    } else {
      card.innerHTML = `<span class="file-icon">${fileIconFor(file.type)}</span><span class="file-name">${file.name}</span>`;
    }
    el.appendChild(card);
  }

  if (content) {
    const textEl = document.createElement("div");
    textEl.textContent = content;
    el.appendChild(textEl);
  }

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

async function handleSend(text) {
  if (messagesEl.querySelector(".empty-state")) messagesEl.innerHTML = "";

  const fileToSend = selectedFile;
  appendLocalMessage("user", text, fileToSend);
  clearSelectedFile();

  const typingEl = document.createElement("div");
  typingEl.className = "message assistant typing";
  typingEl.textContent = "Composing a reply...";
  messagesEl.appendChild(typingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const data = await api.sendMessage(text, currentConversationId, fileToSend, selectedModel);
    typingEl.remove();
    await appendMessage("assistant", data.reply.content, undefined, data.reply.model);

    if (!currentConversationId) {
      currentConversationId = data.conversationId;
      exportBtn.disabled = false;
      await loadConversations();
    }
  } catch (err) {
    typingEl.remove();
    showToast(err.message, "error");
  }
}
