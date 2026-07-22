const API_BASE = window.AURA_API_BASE_URL || "/api";

async function apiRequest(endpoint, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("aura_token");
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { success: false, message: "Invalid server response" };
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

const api = {
  register: (name, email, password) => apiRequest("/auth/register", { method: "POST", body: { name, email, password }, auth: false }),
  login: (email, password) => apiRequest("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
  me: () => apiRequest("/auth/me"),
  updateProfile: (name) => apiRequest("/auth/me", { method: "PATCH", body: { name } }),
  changePassword: (currentPassword, newPassword) =>
    apiRequest("/auth/me/password", { method: "PATCH", body: { currentPassword, newPassword } }),

  // Multipart, like sendMessage — the browser sets the boundary itself, so
  // no Content-Type header here.
  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append("avatar", file);

    const headers = {};
    const token = localStorage.getItem("aura_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/auth/me/avatar`, {
      method: "POST",
      headers,
      credentials: "include",
      body: form,
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: "Invalid server response" };
    }
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  },

  listConversations: () => apiRequest("/chat/conversations"),
  renameConversation: (id, title) => apiRequest(`/chat/conversations/${id}`, { method: "PATCH", body: { title } }),
  getMessages: (id) => apiRequest(`/chat/conversations/${id}/messages`),
  deleteConversation: (id) => apiRequest(`/chat/conversations/${id}`, { method: "DELETE" }),

  // message and/or file — at least one is required. Always sent as
  // multipart/form-data so the same endpoint handles both plain text and
  // file uploads; the browser sets the multipart boundary itself, so we
  // must NOT set a Content-Type header here.
  sendMessage: async (message, conversationId, file, model) => {
    const form = new FormData();
    if (message) form.append("message", message);
    if (conversationId) form.append("conversationId", conversationId);
    if (file) form.append("file", file);
    if (model) form.append("model", model);

    const headers = {};
    const token = localStorage.getItem("aura_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/chat/message`, {
      method: "POST",
      headers,
      credentials: "include",
      body: form,
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: "Invalid server response" };
    }
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  },

  // Attachments are served from an authenticated endpoint (not plain static
  // files), so <img> tags need the token attached via a fetched blob URL.
  attachmentBlobUrl: async (relativeUrl) => {
    const filename = relativeUrl.split("/").pop();
    const token = localStorage.getItem("aura_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE}/chat/attachments/${filename}`, { headers, credentials: "include" });
    if (!res.ok) throw new Error(`Couldn't load attachment (${res.status})`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // Returns a raw fetch Response (not parsed JSON) since this downloads a file.
  exportConversation: async (id, format) => {
    const token = localStorage.getItem("aura_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE}/chat/conversations/${id}/export?format=${format}`, {
      headers,
      credentials: "include",
    });
    if (!res.ok) {
      let message = `Export failed (${res.status})`;
      try { message = (await res.json()).message || message; } catch {}
      throw new Error(message);
    }
    return res;
  },

  // Notes
  listNotes: () => apiRequest("/notes"),
  createNote: (title, content) => apiRequest("/notes", { method: "POST", body: { title, content } }),
  updateNote: (id, patch) => apiRequest(`/notes/${id}`, { method: "PATCH", body: patch }),
  deleteNote: (id) => apiRequest(`/notes/${id}`, { method: "DELETE" }),

  // Todos
  listTodos: () => apiRequest("/todos"),
  createTodo: (text, dueDate) => apiRequest("/todos", { method: "POST", body: { text, dueDate } }),
  updateTodo: (id, patch) => apiRequest(`/todos/${id}`, { method: "PATCH", body: patch }),
  deleteTodo: (id) => apiRequest(`/todos/${id}`, { method: "DELETE" }),

  // Admin
  getAdminStats: () => apiRequest("/admin/stats"),
  listAdminUsers: () => apiRequest("/admin/users"),
  updateUserRole: (id, role) => apiRequest(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }),
  deleteUserAccount: (id) => apiRequest(`/admin/users/${id}`, { method: "DELETE" }),

  // Memory ("what AURA knows about me")
  listMemories: () => apiRequest("/memories"),
  deleteMemory: (id) => apiRequest(`/memories/${id}`, { method: "DELETE" }),
  deleteAllMemories: () => apiRequest("/memories", { method: "DELETE" }),

  // Sharing
  shareConversation: (id) => apiRequest(`/chat/conversations/${id}/share`, { method: "POST" }),
  unshareConversation: (id) => apiRequest(`/chat/conversations/${id}/share`, { method: "DELETE" }),
  getSharedConversation: (token) => apiRequest(`/shared/${token}`, { auth: false }),

  // Bookmarks
  toggleBookmark: (messageId) => apiRequest(`/chat/messages/${messageId}/bookmark`, { method: "PATCH" }),
  listBookmarks: () => apiRequest("/chat/bookmarks"),
};
