document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const user = getCurrentUser();
  if (user) document.getElementById("user-label").textContent = user.name || user.email;

  document.getElementById("logout-btn").addEventListener("click", () => {
    api.logout().catch(() => {});
    logoutUser();
  });

  const listEl = document.getElementById("memories-list");
  const emptyEl = document.getElementById("memories-empty");
  const clearAllBtn = document.getElementById("clear-all-btn");

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderMemories(memories) {
    listEl.innerHTML = "";
    emptyEl.hidden = memories.length > 0;
    clearAllBtn.disabled = memories.length === 0;

    memories.forEach((m) => {
      const item = document.createElement("div");
      item.className = "memory-item";

      const textWrap = document.createElement("div");
      const factEl = document.createElement("div");
      factEl.className = "memory-fact";
      factEl.textContent = m.fact;
      const metaEl = document.createElement("div");
      metaEl.className = "memory-meta";
      metaEl.textContent = `Learned ${formatDate(m.createdAt)}`;
      textWrap.appendChild(factEl);
      textWrap.appendChild(metaEl);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "memory-delete-btn";
      deleteBtn.setAttribute("aria-label", "Forget this");
      deleteBtn.innerHTML = "✕";
      deleteBtn.addEventListener("click", async () => {
        deleteBtn.disabled = true;
        try {
          await api.deleteMemory(m._id);
          item.remove();
          if (!listEl.children.length) {
            emptyEl.hidden = false;
            clearAllBtn.disabled = true;
          }
          showToast("Forgotten");
        } catch (err) {
          showToast(err.message, "error");
          deleteBtn.disabled = false;
        }
      });

      item.appendChild(textWrap);
      item.appendChild(deleteBtn);
      listEl.appendChild(item);
    });
  }

  clearAllBtn.addEventListener("click", async () => {
    if (!confirm("Clear everything AURA has learned about you? This can't be undone.")) return;
    clearAllBtn.disabled = true;
    try {
      await api.deleteAllMemories();
      renderMemories([]);
      showToast("Cleared everything AURA knew about you");
    } catch (err) {
      showToast(err.message, "error");
      clearAllBtn.disabled = false;
    }
  });

  try {
    const data = await api.listMemories();
    renderMemories(data.memories);
  } catch (err) {
    showToast(err.message, "error");
  }
});
