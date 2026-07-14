# AURA Mobile (Capacitor wrapper)

This wraps the existing AURA web frontend into real native Android/iOS apps
using [Capacitor](https://capacitorjs.com). It reuses your actual HTML/CSS/JS
— no rewrite — the native shell just loads it and gives you an installable
app icon, native splash screen, and eventually a Play Store/App Store listing.

## What's been verified in this build
- `npx cap init` — ran for real, generated a genuine `capacitor.config.ts`
- `npx cap add android` — ran for real, generated a complete, valid Android
  Studio project with a working Gradle wrapper and manifest
- Your frontend assets were actually copied into
  `android/app/src/main/assets/public/`

What I *can't* verify from this sandbox: actually compiling/running the app,
since that needs the Android SDK (or Xcode for iOS), which isn't available
here. That part happens on your machine.

## Before you do anything else: point it at your real backend

Mobile apps don't share an origin with your backend the way a browser tab
does. Open `www/assets/js/config.js` (or `frontend/assets/js/config.js` if
you're re-copying) and change:
```js
window.AURA_API_BASE_URL = "/api";
```
to your actual deployed backend URL:
```js
window.AURA_API_BASE_URL = "https://your-backend.onrender.com/api";
```
**This only works once your backend is deployed somewhere reachable from the
internet** — `localhost` on your laptop is not reachable from a phone. If you
haven't deployed the backend yet, that's the real next step (Render, Railway,
Fly.io, or similar all have free tiers).

Also add your backend's `CLIENT_URL` env var if you deploy a hosted version
of the frontend too — the Capacitor app itself is already allowed via its
native origins (`capacitor://localhost`), which `backend/server.js` accepts
by default.

## Building for Android

Requires [Android Studio](https://developer.android.com/studio) installed
locally (this step can't be done in a sandbox — it needs the Android SDK).

```bash
cd mobile
npm install
npx cap sync android      # re-copies www/ into the native project after any change
npx cap open android      # opens Android Studio
```

In Android Studio: let Gradle sync finish, then Run ▶ on an emulator or a
plugged-in phone with USB debugging enabled.

## Building for iOS

Requires a Mac with Xcode installed (also can't be done in this sandbox).

```bash
cd mobile
npx cap add ios      # only needed once
npx cap sync ios
npx cap open ios
```

## After any change to the web app

Whenever you edit `frontend/`, copy those changes into `mobile/www/` and run
`npx cap sync` again — Capacitor doesn't watch for changes automatically.
```bash
cp -r frontend/* mobile/www/
cd mobile && npx cap sync
```

## Known housekeeping item
`npm install` in this folder currently reports 2 high-severity advisories,
both in `tar`, a transitive dependency of `@capacitor/cli` — it's a build-time
tool dependency, not code that ships in your app, but if you want it gone:
`npx cap` has since moved to major version 8, which resolves it but is a
breaking change from the 6.x used here. Worth doing before a real public
release; not urgent for local testing.

## Publishing (later, once it's working)
- Android: needs a signed release build + a $25 one-time Google Play Console fee
- iOS: needs an Apple Developer account ($99/year) + App Store review
Both are meaningfully more work than this scaffolding step — happy to walk
through either when you're ready for it.
