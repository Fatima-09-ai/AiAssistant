// Small local copy of chat.js's markdown rendering — kept separate rather
// than loading chat.js itself, since that file expects a whole app shell
// (composer, sidebar, etc.) that doesn't exist on this public page.
function renderMarkdown(raw) {
  if (typeof marked === "undefined" || typeof DOMPurify === "undefined") return null;
  try {
    marked.setOptions({ breaks: true, gfm: true });
    const dirty = marked.parse(raw);
    return DOMPurify.sanitize(dirty, { ADD_ATTR: ["target", "rel"] });
  } catch {
    return null;
  }
}

function highlightCodeBlocks(container) {
  if (typeof hljs === "undefined") return;
  container.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
}

function buildMessageEl(m) {
  const el = document.createElement("div");
  el.className = `message ${m.role}`;

  const textEl = document.createElement("div");
  textEl.className = "message-text";
  if (m.role === "assistant") {
    const html = renderMarkdown(m.content);
    if (html !== null) {
      textEl.classList.add("markdown-body");
      textEl.innerHTML = html;
    } else {
      textEl.textContent = m.content;
    }
  } else {
    textEl.textContent = m.content;
  }
  el.appendChild(textEl);

  if (m.hasAttachments) {
    const note = document.createElement("div");
    note.className = "shared-attachment-note";
    note.textContent = "📎 This message had an attachment, not shown in shared view.";
    el.appendChild(note);
  }

  return el;
}

document.addEventListener("DOMContentLoaded", async () => {
  const titleEl = document.getElementById("shared-title");
  const messagesEl = document.getElementById("shared-messages");
  const errorEl = document.getElementById("shared-error");

  const token = new URLSearchParams(location.search).get("token");
  if (!token) {
    errorEl.hidden = false;
    return;
  }

  try {
    const data = await api.getSharedConversation(token);
    titleEl.textContent = data.title || "Shared chat";
    document.title = `${data.title || "Shared chat"} — AURA`;

    data.messages.forEach((m) => messagesEl.appendChild(buildMessageEl(m)));
    highlightCodeBlocks(messagesEl);
  } catch {
    errorEl.hidden = false;
  }
});
