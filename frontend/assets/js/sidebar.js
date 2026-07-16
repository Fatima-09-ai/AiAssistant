function openSidebar() {
  document.querySelector(".sidebar")?.classList.add("open");
  document.getElementById("sidebar-backdrop")?.classList.add("visible");
  document.body.classList.add("sidebar-open-lock");
}

function closeSidebar() {
  document.querySelector(".sidebar")?.classList.remove("open");
  document.getElementById("sidebar-backdrop")?.classList.remove("visible");
  document.body.classList.remove("sidebar-open-lock");
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("sidebar-toggle")?.addEventListener("click", toggleSidebar);
  document.getElementById("sidebar-backdrop")?.addEventListener("click", closeSidebar);

  // Close the drawer whenever a nav-like control inside the sidebar is used,
  // so picking a conversation/link doesn't leave the drawer open on mobile.
  document.querySelector(".sidebar")?.addEventListener("click", (e) => {
    if (window.innerWidth > 900) return;
    const target = e.target.closest("a, .conversation-item, #new-chat-btn, #logout-btn");
    if (target) closeSidebar();
  });

  // If the viewport is resized past the mobile breakpoint, make sure the
  // drawer state doesn't linger in a weird half-open way.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeSidebar();
  });
});
