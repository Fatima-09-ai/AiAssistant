function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("aura_theme", theme);
  document.querySelectorAll(".theme-toggle-icon").forEach((el) => {
    el.textContent = theme === "dark" ? "☀️" : "🌙";
  });
  document.querySelectorAll(".theme-toggle-label").forEach((el) => {
    el.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

document.addEventListener("DOMContentLoaded", () => {
  // Sync icon/label with whatever the blocking inline script already set,
  // since that runs before this file loads.
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current);

  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });
});
