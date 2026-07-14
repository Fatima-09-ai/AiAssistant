// Intentionally minimal. AURA's frontend doesn't need any native OS APIs
// (no filesystem access, no native menus triggered from the page), so this
// preload script exists mainly to keep contextIsolation on without breaking
// anything, per Electron's current security recommendations.
