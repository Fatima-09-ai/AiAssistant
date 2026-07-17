function saveSession(token, user) {
  localStorage.setItem("aura_token", token);
  localStorage.setItem("aura_user", JSON.stringify(user));
}

function getCurrentUser() {
  const raw = localStorage.getItem("aura_user");
  return raw ? JSON.parse(raw) : null;
}

// Merges a partial update (e.g. new name or avatarUrl) into the cached user
// object, so the sidebar label/avatar reflect it immediately without
// waiting for a fresh /auth/me call.
function updateStoredUser(patch) {
  const current = getCurrentUser();
  if (!current) return;
  localStorage.setItem("aura_user", JSON.stringify({ ...current, ...patch }));
}

function requireAuth() {
  if (!localStorage.getItem("aura_token")) {
    window.location.href = "login.html";
  }
}

function logoutUser() {
  localStorage.removeItem("aura_token");
  localStorage.removeItem("aura_user");
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const errorEl = document.getElementById("form-error");
      errorEl.textContent = "";
      try {
        const data = await api.login(email, password);
        saveSession(data.token, data.user);
        window.location.href = "chat.html";
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const errorEl = document.getElementById("form-error");
      errorEl.textContent = "";
      try {
        const data = await api.register(name, email, password);
        saveSession(data.token, data.user);
        window.location.href = "chat.html";
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }
});
