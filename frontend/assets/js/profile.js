document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const nameInput = document.getElementById("name-input");
  const emailDisplay = document.getElementById("email-display");
  const nameForm = document.getElementById("name-form");
  const nameMessage = document.getElementById("name-message");

  const avatarImg = document.getElementById("avatar-img");
  const avatarInitial = document.getElementById("avatar-initial");
  const avatarInput = document.getElementById("avatar-input");
  const avatarUploadBtn = document.getElementById("avatar-upload-btn");

  const passwordForm = document.getElementById("password-form");
  const passwordMessage = document.getElementById("password-message");

  document.getElementById("logout-btn").addEventListener("click", () => {
    api.logout().catch(() => {});
    logoutUser();
  });

  function renderUser(user) {
    document.getElementById("user-label").textContent = user.name || user.email;
    nameInput.value = user.name || "";
    emailDisplay.textContent = user.email || "";
    if (user.avatarUrl) {
      avatarImg.src = user.avatarUrl;
      avatarImg.hidden = false;
      avatarInitial.hidden = true;
    } else {
      avatarImg.hidden = true;
      avatarInitial.hidden = false;
      avatarInitial.textContent = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
    }
  }

  // Show cached data immediately, then refresh from the server in case it
  // changed on another device.
  const cached = getCurrentUser();
  if (cached) renderUser(cached);
  try {
    const data = await api.me();
    updateStoredUser(data.user);
    renderUser(data.user);
  } catch (err) {
    showToast(err.message, "error");
  }

  // --- Name ---
  nameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    nameMessage.textContent = "";
    nameMessage.className = "form-message";
    if (!name) return;

    try {
      const data = await api.updateProfile(name);
      updateStoredUser(data.user);
      renderUser(data.user);
      nameMessage.textContent = "Name updated.";
      nameMessage.className = "form-message success";
      showToast("Name updated");
    } catch (err) {
      nameMessage.textContent = err.message;
      nameMessage.className = "form-message error";
    }
  });

  // --- Avatar ---
  avatarUploadBtn.addEventListener("click", () => avatarInput.click());

  avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be under 5MB.", "error");
      avatarInput.value = "";
      return;
    }

    const originalLabel = avatarUploadBtn.textContent;
    avatarUploadBtn.disabled = true;
    avatarUploadBtn.textContent = "Uploading...";

    try {
      const data = await api.uploadAvatar(file);
      updateStoredUser(data.user);
      renderUser(data.user);
      showToast("Profile photo updated");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      avatarUploadBtn.disabled = false;
      avatarUploadBtn.textContent = originalLabel;
      avatarInput.value = "";
    }
  });

  // --- Password ---
  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    passwordMessage.textContent = "";
    passwordMessage.className = "form-message";

    const currentPassword = document.getElementById("current-password-input").value;
    const newPassword = document.getElementById("new-password-input").value;
    const confirmPassword = document.getElementById("confirm-password-input").value;

    if (newPassword.length < 6) {
      passwordMessage.textContent = "New password must be at least 6 characters.";
      passwordMessage.className = "form-message error";
      return;
    }
    if (newPassword !== confirmPassword) {
      passwordMessage.textContent = "New password and confirmation don't match.";
      passwordMessage.className = "form-message error";
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      passwordMessage.textContent = "Password updated.";
      passwordMessage.className = "form-message success";
      passwordForm.reset();
      showToast("Password updated");
    } catch (err) {
      passwordMessage.textContent = err.message;
      passwordMessage.className = "form-message error";
    }
  });
});
