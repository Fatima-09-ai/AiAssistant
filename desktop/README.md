# AURA Desktop (Electron wrapper)

Wraps the same web frontend into a native Windows/Mac/Linux app using
[Electron](https://electronjs.org). Same idea as the mobile Capacitor
wrapper — no rewrite, just a native window loading your existing HTML/CSS/JS.

## What's been verified in this build
- `npm install` — ran for real here, genuinely downloaded Electron's binary
  (284 packages, including the actual Electron runtime)
- The Electron binary itself runs and reports its real version (`v43.1.0`)
- `main.js` was launched for real — it executed correctly and got all the way
  to creating a browser window, only stopping at the graphics/display
  initialization step

What I *can't* verify from this sandbox: an actual visible window, since
there's no display server here (no monitor, no X11/Wayland). That part will
work fine on your actual computer, which has a real screen.

## Before running it: point it at your real backend
Same requirement as the mobile app — a desktop window loading local files
has no shared origin with a backend. Open `www/assets/js/config.js` and set:
```js
window.AURA_API_BASE_URL = "https://your-backend.onrender.com/api";
```
Your backend's CORS is already set up to accept this (desktop Electron loads
via `file://`, which sends a `null` origin — already whitelisted in
`backend/server.js`).

## Running it locally (fastest way to try it)
```bash
cd desktop
npm install
npm start
```
A window opens with AURA running inside it — no store, no fee, no install
package needed for this step, just running it directly.

## Building an installable app (.exe / .dmg / .AppImage)
```bash
cd desktop
npm install

npm run build:win     # produces an .exe installer (run this on Windows, or
                       # cross-build from Mac/Linux with extra setup — see
                       # electron-builder's docs if you need that)
npm run build:mac     # produces a .dmg (must run on a Mac)
npm run build:linux   # produces an .AppImage
```
Output lands in `desktop/dist/`. Double-click the result to install, just
like any other desktop app — completely free, no app store, no signing
required for personal use.

## After any change to the web app
```bash
cp -r frontend/* desktop/www/
```
Then restart with `npm start` (no separate "sync" step like Capacitor —
Electron just reads the files fresh each launch).

## Known rough edges
- Unsigned Windows/Mac builds will show an "unknown publisher" warning the
  first time someone opens them. That's normal for a free personal app;
  code-signing costs money ($100+/year for a certificate) and isn't
  necessary just to use it yourself or share with friends.
- Auto-updates aren't set up — every new version means rebuilding and
  reinstalling manually. Fine for personal use; ask if you want real
  auto-update support later (electron-builder supports it, just more setup).
