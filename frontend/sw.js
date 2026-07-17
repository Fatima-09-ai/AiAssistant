/**
 * Minimal service worker for AURA.
 *
 * Its only real job is to exist: Chrome on Android only offers the full
 * "Install app" flow (standalone window, no address bar) to sites that
 * register a service worker with a fetch handler. Without one, "Add to
 * Home Screen" just creates a shortcut that opens the site in a normal
 * browser tab — with the URL bar visible.
 *
 * This app is live/authenticated, so it deliberately does NOT cache
 * anything — every request is passed straight through to the network.
 * If offline support is ever wanted, this is the place to add it.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
