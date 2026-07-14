# AURA — AI Assistant (Starter Core)

A working core for a ChatGPT/Jarvis-style AI assistant: JWT auth, MongoDB Atlas,
Groq-powered chat with lightweight long-term memory, and a voice-enabled
chat UI (speech-to-text + text-to-speech via the browser's Web Speech API).

This is the **verified, working foundation** — not the full feature set. It's built
this way on purpose: everything below actually runs, and you add features
(notes/todos, admin panel, PDF export, email verification, etc.) in focused
passes on top of it, rather than getting a huge pile of unverified code.

## Why Groq instead of Gemini
Gemini's free tier has region-based gating that blocks it entirely for some
accounts/locations, even on a brand-new project. Groq's free tier requires no
credit card and isn't reported to have that regional restriction. It's also
an OpenAI-compatible endpoint, fast (LPU hardware), and easy to swap later if
you want a different provider — the whole integration lives in one file:
`backend/services/groqService.js`.

## What's included
- Register / login / logout / get current user (JWT, httpOnly cookie + bearer token)
- Conversations + messages stored in MongoDB
- Groq chat integration (`services/groqService.js`) with two selectable text
  models — "✨ Smart" (`openai/gpt-oss-120b`, better reasoning, default) and
  "⚡ Fast" (`openai/gpt-oss-20b`, quicker) — toggled from the chat header,
  choice persists in localStorage. Images always use the vision model
  regardless of this setting.
- File & image uploads AURA can actually read: PDFs and .docx are text-extracted
  and dropped into the prompt as context; images are sent to a vision-capable
  Groq model (`qwen/qwen3.6-27b`) so AURA can describe or answer questions about
  them. Attachments are served back through an authenticated endpoint, not a
  public static folder, so one user can't guess another user's file URL.
- Notes & Todos page (`notes.html`) — pinnable notes with inline editing, and
  a todo list with due dates and inline text editing. Both are per-user and
  reachable from the "📝 Notes & Todos" link in the chat sidebar.
- Rename conversations — double-click a conversation's title in the sidebar,
  or hit the ✏️ button that appears on hover; Enter saves, Escape cancels.
- Admin panel (`admin.html`) — stat cards (users, new signups this week,
  conversations, messages, notes, todos) and a user table with promote/demote
  and delete (cascades to that user's conversations, messages, uploaded files,
  notes, todos, and memories). Only visible in the sidebar to accounts with
  the `admin` role; the backend enforces this independently via `adminOnly`
  middleware, so the link being hidden isn't the actual security boundary.
- Simple memory system: extracts durable facts ("my name is...", "I live in...")
  and injects them into future prompts (`services/memoryService.js`)
- Chat UI with mic input (SpeechRecognition) and spoken replies (SpeechSynthesis)
- Delete conversations from the sidebar (also cleans up any uploaded files)
- Export any conversation as .txt or .pdf
- Dark glassmorphic UI (landing, login, signup, chat)

## What's NOT included yet (next passes)
- Email verification & password reset emails
- Refresh tokens

## Setup

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — your MongoDB Atlas connection string (Atlas → Database → Connect → Drivers)
- `JWT_SECRET` — any long random string
- `GROQ_API_KEY` — from https://console.groq.com/keys (free, no credit card)
- `GROQ_MODEL` / `GROQ_VISION_MODEL` — optional overrides; Groq deprecates and
  replaces models fairly often, so if chat or image replies start failing with
  a "model_decommissioned" error, check https://console.groq.com/docs/models
  and update these.

Run it:
```bash
npm run dev   # requires nodemon (npm install -g nodemon), or:
npm start
```

Server boots on `http://localhost:5000` and also serves the `frontend/` folder
as static files — so you can just open `http://localhost:5000` in your browser.

### File uploads
Click the 📎 button next to the composer to attach a file (with or without a
typed message). Supported: images (png/jpg/webp/gif) — AURA looks at them with
a vision model — and documents (pdf/docx/txt/csv/md) — AURA reads the extracted
text as context. 15MB max per file, one file per message.

### Admin panel
There's intentionally no signup checkbox for this — grant it deliberately:
```bash
cd backend
node utils/seedAdmin.js your-email@example.com
```
Then log out and back in so your session picks up the new role. A "🛡️ Admin
panel" link will appear in the chat sidebar.

### 2. Frontend
No build step. It's served directly by Express from `/frontend`. If you'd
rather run it separately (e.g. Live Server on port 5500), set `CLIENT_URL`
in `.env` to match, for CORS.

### 3. Try it
1. Open `http://localhost:5000`
2. Sign up
3. You'll land on the chat page — type a message or press the mic button
4. AURA replies via Gemini and speaks the reply aloud

## Folder structure
```
aura-ai-assistant/
├── backend/
│   ├── config/db.js
│   ├── models/          User, Conversation, Message (+ attachments), Memory, Note, Todo
│   ├── middlewares/     authMiddleware, errorHandler, uploadMiddleware
│   ├── services/        groqService, memoryService
│   ├── utils/           generateToken, exportConversation, fileProcessor, seedAdmin
│   ├── controllers/     authController, chatController, notesController, todosController, adminController
│   ├── routes/          authRoutes, chatRoutes, notesRoutes, todosRoutes, adminRoutes
│   ├── uploads/         uploaded files land here (gitignored)
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── assets/css/      global.css, chat.css, notes.css, admin.css
    ├── assets/js/       api.js, toast.js, auth.js, voice.js, chat.js, notes.js, admin.js
    ├── index.html       landing page
    ├── login.html
    ├── signup.html
    ├── chat.html
    ├── notes.html       notes + todos workspace
    └── admin.html       admin panel (admin role only)
```

## Verified working (already tested in this build)
- `npm install` completes cleanly, 0 vulnerabilities
- All backend files pass `node --check` syntax validation
- Full module graph loads with no import/wiring errors
- Text extraction confirmed against real files: a real PDF (built with pdfkit)
  and a real .docx (built with the `docx` package) both extracted correctly;
  a corrupted/fake PDF fails gracefully (returns "", doesn't crash the request)
- Image → base64 data URL conversion verified on a real PNG
- Real multipart upload tested against the actual multer middleware via curl:
  valid text file accepted, valid image accepted, disallowed type (.exe) correctly
  rejected with 400
- `toGroqMessage` (builds the message sent to Groq) directly unit-tested for
  all 4 cases: plain text, document with extracted text, image on the current
  turn (inlined as base64), image on an older turn (noted as text, not resent)
- Notes/Todos controllers directly unit-tested: empty-note rejection,
  content-only note gets a default title, 404s on missing note/todo, blank
  todo text rejected on both create and update, completion toggling
- Notes/Todos routes tested through the real Express app + real JWT middleware
  (DB calls mocked): unauthenticated request correctly gets 401, authenticated
  requests correctly reach list/create handlers
- Rename-conversation guard clauses directly unit-tested: empty title rejected,
  over-60-char title rejected, missing conversation → 404, valid title trimmed
  and saved
- Rename-conversation route tested through the real Express app + real JWT
  middleware (DB mocked): PATCH with a valid token succeeds, no token → 401
- Groq model selection (`generateReply`) directly tested with a mocked fetch:
  "smart" → gpt-oss-120b, "fast" → gpt-oss-20b, an invalid choice falls back
  to "smart", and an image attachment forces the vision model regardless of
  the selected text model
- Full `/api/chat/message` route tested end-to-end (real Express + JWT, Groq
  fetch mocked) confirming `model: "fast"`/`"smart"`/unset all resolve to the
  correct underlying model in the response
- Admin controller guard clauses directly unit-tested: invalid role rejected,
  admin can't change their own role, admin can't delete their own account,
  404 on a missing user, valid promote succeeds
- Cascading delete directly verified to touch all six collections (User,
  Conversation, Message, Note, Todo, Memory) plus uploaded attachment files
- Full admin routes tested through the real Express app + real JWT +
  `adminOnly` middleware: a regular user gets 403, no token gets 401, an
  admin passes through; promote/demote/delete all tested via real HTTP calls
- Element IDs cross-referenced between chat.html/chat.js, notes.html/notes.js,
  and admin.html/admin.js — no mismatches
- `/api/health` responds `{ success: true, status: "ok" }`
- Protected routes correctly return `401` without a valid token

## Next steps
Tell me which feature to layer on next — email verification, refresh tokens,
or something else — and I'll build it directly on this verified core.
#   A i A s s i s t a n t  
 