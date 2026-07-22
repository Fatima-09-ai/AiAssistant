document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const user = getCurrentUser();
  const userLabel = document.getElementById("user-label");
  if (userLabel && user) userLabel.textContent = user.name;

  document.getElementById("logout-btn").addEventListener("click", logoutUser);

  await loadBookmarks();
});

function roleLabel(role) {
  return role === "user" ? "You" : "AURA";
}

async function loadBookmarks() {
  const listEl = document.getElementById("bookmarks-list");
  const emptyEl = document.getElementById("bookmarks-empty");
  try {
    const { bookmarks } = await api.listBookmarks();
    listEl.innerHTML = "";
    emptyEl.hidden = bookmarks.length > 0;

    for (const b of bookmarks) {
      const card = document.createElement("div");
      card.className = "bookmark-card";

      const meta = document.createElement("div");
      meta.className = "bookmark-meta";
      const convLink = document.createElement("a");
      convLink.className = "bookmark-conv-title";
      convLink.href = b.conversationId ? `chat.html?conversation=${b.conversationId}` : "chat.html";
      convLink.textContent = b.conversationTitle;
      const role = document.createElement("span");
      role.className = "bookmark-role";
      role.textContent = roleLabel(b.role);
      meta.appendChild(convLink);
      meta.appendChild(role);

      const content = document.createElement("div");
      content.className = "bookmark-content";
      content.textContent = b.content;

      const actions = document.createElement("div");
      actions.className = "bookmark-actions";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost";
      removeBtn.style.padding = "5px 12px";
      removeBtn.style.fontSize = "12.5px";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        removeBtn.disabled = true;
        try {
          await api.toggleBookmark(b._id);
          card.remove();
          if (!listEl.children.length) emptyEl.hidden = false;
          showToast("Bookmark removed");
        } catch (err) {
          showToast(err.message, "error");
          removeBtn.disabled = false;
        }
      });
      actions.appendChild(removeBtn);

      card.appendChild(meta);
      card.appendChild(content);
      card.appendChild(actions);
      listEl.appendChild(card);
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}
