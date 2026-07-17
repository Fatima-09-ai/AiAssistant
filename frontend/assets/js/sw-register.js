// Registers the service worker so Chrome offers a real "Install app"
// prompt (standalone, no address bar) instead of a plain shortcut.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability just won't be offered; nothing else depends on this.
    });
  });
}
