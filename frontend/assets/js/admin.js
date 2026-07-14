let adminSelf = null;

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const user = getCurrentUser();
  if (user) document.getElementById("user-label").textContent = user.name || user.email;

  document.getElementById("logout-btn").addEventListener("click", () => {
    api.logout().catch(() => {});
    logoutUser();
  });

  // Belt-and-suspenders client-side check — the real gate is the backend's
  // adminOnly middleware, this just avoids flashing the page at a non-admin
  // before their /admin/* calls come back with 403.
  if (!user || user.role !== "admin") {
    showToast("Admin access required", "error");
    window.location.href = "chat.html";
    return;
  }
  adminSelf = user;

  await loadStats();
  await loadUsers();
});

async function loadStats() {
  try {
    const { stats } = await api.getAdminStats();
    renderStats(stats);
  } catch (err) {
    showToast(err.message, "error");
    if (err.message.includes("Admin access")) window.location.href = "chat.html";
  }
}

function renderStats(stats) {
  const grid = document.getElementById("stats-grid");
  const cards = [
    { label: "Total users", value: stats.totalUsers },
    { label: "New this week", value: stats.newUsersThisWeek },
    { label: "Conversations", value: stats.totalConversations },
    { label: "Messages", value: stats.totalMessages },
    { label: "Notes", value: stats.totalNotes },
    { label: "Todos", value: stats.totalTodos },
  ];
  grid.innerHTML = cards
    .map((c) => `<div class="stat-card"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`)
    .join("");
}

async function loadUsers() {
  try {
    const { users } = await api.listAdminUsers();
    renderUsers(users);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderUsers(users) {
  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = "";

  for (const u of users) {
    const isSelf = u._id === adminSelf.id;
    const row = document.createElement("tr");

    const joined = new Date(u.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

    row.innerHTML = `
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="role-badge ${u.role}">${u.role}</span></td>
      <td>${u.conversationCount}</td>
      <td>${joined}</td>
    `;

    const actionsCell = document.createElement("td");
    actionsCell.className = "user-actions";

    if (isSelf) {
      actionsCell.innerHTML = `<span class="self-tag">You</span>`;
    } else {
      const roleBtn = document.createElement("button");
      roleBtn.className = "btn btn-ghost small-btn";
      roleBtn.textContent = u.role === "admin" ? "Demote" : "Promote";
      roleBtn.addEventListener("click", async () => {
        const newRole = u.role === "admin" ? "user" : "admin";
        try {
          await api.updateUserRole(u._id, newRole);
          showToast(`${u.email} is now ${newRole}`);
          await loadUsers();
        } catch (err) {
          showToast(err.message, "error");
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-ghost small-btn danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Delete ${u.email}? This permanently removes their account, conversations, notes, and todos.`
        );
        if (!confirmed) return;
        try {
          await api.deleteUserAccount(u._id);
          showToast(`${u.email} deleted`);
          await loadUsers();
          await loadStats();
        } catch (err) {
          showToast(err.message, "error");
        }
      });

      actionsCell.appendChild(roleBtn);
      actionsCell.appendChild(deleteBtn);
    }

    row.appendChild(actionsCell);
    tbody.appendChild(row);
  }
}
