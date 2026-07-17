function setRealViewportHeight() {
  // dvh isn't supported on older mobile browsers (pre-iOS 15.4 Safari, older
  // Android webviews), so it silently falls back to 100vh and the mobile
  // scroll-gap bug comes back. This sets a --real-vh custom property from the
  // actual visible viewport height, which works everywhere.
  const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
  document.documentElement.style.setProperty("--real-vh", `${vh}px`);
}

setRealViewportHeight();
window.addEventListener("resize", setRealViewportHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", setRealViewportHeight);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("aura_theme", theme);
  document.querySelectorAll(".theme-toggle-icon").forEach((el) => {
    el.textContent = theme === "dark" ? "☀️" : "🌙";
  });
  document.querySelectorAll(".theme-toggle-label").forEach((el) => {
    el.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  });

  // Only present on chat.html, where code blocks can appear in messages.
  const hljsDark = document.getElementById("hljs-theme-dark");
  const hljsLight = document.getElementById("hljs-theme-light");
  if (hljsDark && hljsLight) {
    hljsDark.disabled = theme !== "dark";
    hljsLight.disabled = theme === "dark";
  }
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
