# Onsite as a VS Code extension — design

Date: 2026-08-23
New code under: `extension/` (the existing static web app, `proxy/`, and README stay in place)

## Problem / motivation

Onsite today is a single static HTML page. Two limits pushed this conversion:

1. **CORS.** OpenAI sends no `Access-Control-Allow-Origin` header, so a browser cannot
   call `api.openai.com` at all — the static page needs a self-hosted proxy to work.
2. **Layout fragility** on mobile Safari (iPad Pro), plus the page can only ever offer
   an embedded editor, not a real IDE.

A VS Code extension resolves both: the extension **host runs in Node**, so it calls
OpenAI directly with **no CORS and no proxy**; and the candidate writes in VS Code's
**real editor**. The iPad Safari layout bug becomes moot.

## Goals

1. Conduct the same voice-driven mock interview (persona "Sam"), inside VS Code.
2. Candidate writes the solution in a **real VS Code editor** (`Solution.java`).
3. **No proxy** — the Node host makes all OpenAI calls directly.
4. **Button-driven UX**, not commands: start, settings, and all interview actions are
   buttons. The Command Palette is not part of the normal workflow.
5. Full voice parity: hands-free mic with adaptive endpointing, transcription, neural
   TTS, plus typing — ported from the web app.
6. Reuse the existing ~94-problem pattern-grouped bank and Java starter skeletons.
7. Distribute as a side-loadable `.vsix`; keep the web app in the repo.

## Non-goals

- No Marketplace publishing in v1 (side-load `.vsix`; can add later).
- No full Java IntelliSense/project setup — the solution file is an **untitled** Java
  document (real editing + syntax highlighting; IntelliSense only if the user later
  saves it into a Java project). Accepted for v1.
- No OpenAI Realtime API / streaming speech-to-speech.
- The existing static web app and `proxy/` are left untouched (not deleted).

## Architecture — two processes, three UI regions

### Processes

**Extension host (Node.js)** — owns everything needing secrets or network:
- OpenAI client: chat completions, transcription, TTS (Node `fetch`; no CORS).
- Problem bank + starter skeletons.
- `SecretStorage` for the API key; `globalState` for all other settings.
- Reads the candidate's `Solution.java` `TextDocument` text each turn.
- Orchestrates the interview session and the two webviews.

**Webviews (Chromium)** — two of them, holding **no key and making no API calls**:
- **Bottom-Panel "Sam" view** — home state (problem dropdown, Start, ⚙ Settings) and
  interview state (transcript, status orb, talkbar). Captures the mic (MediaRecorder +
  Web Audio VAD with adaptive endpointing, ported verbatim) and plays TTS audio.
- **Settings page** — a dedicated editor-area webview with the full settings form.

### Three on-screen regions during an interview

1. **Editor column 1** — `Solution.java`, an untitled Java document prefilled with the
   selected problem's starter skeleton.
2. **Editor column 2 (Beside)** — the problem statement as a read-only Markdown preview.
3. **Bottom Panel** — the Sam view (chat + voice), docked like the Terminal, resizable.

## UI & interaction (button-driven)

### Entry point
- The Sam view is contributed to the **Panel** container, so it appears as a tab in the
  bottom panel (next to Terminal/Problems).
- A **status-bar item "🟠 Onsite"** reveals/focuses the panel if it was closed. This is
  the sanctioned way to reopen it.

### Bottom-Panel "Sam" view
- **Home state** (no interview running): a **problem dropdown** grouped by pattern
  (optgroups, mirroring the web app's `<select>`), a **Start interview** button, and a
  **⚙ Settings** button.
- **Interview state**: status orb + interviewer name, scrolling transcript, and a
  talkbar with **🎤 mic**, **Send** (+ text input), **Hint**, **Share code**,
  **End & feedback**, **mute**. **End** returns to the home state.

### Settings page (separate editor-area webview)
Opened by the ⚙ button. Ports the web app's settings modal into a roomy page:
- **OpenAI API key** (password field) + reassurance note.
- **Bot model** (`gpt-5.6` default; `gpt-5.5`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`).
- **Transcription model** (`gpt-4o-transcribe` default; mini; `whisper-1`).
- **Interviewer voice**: voice mode (Neural default / Browser), OpenAI voice, TTS model,
  **speech speed**, **Test voice** button.
- **Interviewer**: name, pronoun.
- **Save** button. On save: key → `SecretStorage`; all other fields → `globalState`.

## Data flow — one interview turn

1. **Start**: user picks a problem in the dropdown → clicks **Start interview**. Host
   opens the untitled `Solution.java` (col 1) with the skeleton, opens the problem
   Markdown preview (col 2), switches the Sam view to interview state, initializes the
   chat session, and Sam greets + states the problem (text + TTS).
2. **Spoken turn**: webview VAD detects end-of-turn → posts the recorded audio (bytes)
   to the host → host transcribes (`/v1/audio/transcriptions`), reads the current
   `Solution.java` text, calls chat (`/v1/chat/completions`), then TTS
   (`/v1/audio/speech`) → posts `{ yourText, samText, audioBytes }` back → webview shows
   both bubbles and plays Sam's voice → mic re-arms.
3. **Typed turn**: same path, minus transcription.
4. **Hint / Share code / End & feedback**: button → host message → same round-trip
   (Share code forces a fresh read of the editor; End asks Sam for a short assessment
   and returns to home state).

All OpenAI calls are centralized in the host; the webview only streams mic bytes up and
plays audio down. GPT-5 request shape is carried over: `max_completion_tokens`,
`reasoning_effort:"low"`, no `temperature`.

## Message protocol (webview ↔ host)

**Sam view → host:** `ready`, `startInterview{problemId}`, `userText{text}`,
`audioCaptured{bytes}`, `hint`, `shareCode`, `endInterview`, `openSettings`,
`muteToggle{muted}`.

**Host → Sam view:** `settings{name,pronoun,voiceMode,speed,...}`,
`interviewStarted{problem}`, `presence{state,label}`, `userBubble{text}`,
`samBubble{text}`, `tts{audioBytes}` (or `speakBrowser{text}` when voiceMode=browser),
`banner{html,kind}`, `home`.

**Settings page → host:** `loadSettings`, `saveSettings{...}`, `testVoice{...}`.
**Host → Settings page:** `settings{...}` (current values, key masked as "set/unset").

## Components / file structure

```
extension/
  package.json          # manifest: panel view, settings command wiring, status bar,
                        #   activation events, contributes; NO configuration section
  tsconfig.json
  esbuild.js            # bundle host + webview scripts
  src/
    extension.ts        # activate(): register panel WebviewViewProvider, settings
                        #   page opener, status-bar item; wire messages
    openai.ts           # chatCompletion(), transcribe(), synthesizeSpeech() (Node)
    problems.ts         # ported PROBLEMS bank + STARTERS skeletons + grouping
    interview.ts        # session state, systemPrompt(), turn orchestration
    store.ts            # getKey/setKey (SecretStorage); getSettings/setSettings
                        #   (globalState) with defaults
    panel.ts            # Sam bottom-panel webview: HTML + host-side bridge
    settingsPage.ts     # settings editor-area webview: HTML + host-side bridge
    problemDoc.ts       # untitled Solution.java creation; problem Markdown preview
    media/
      panel.js panel.css        # transcript UI, VAD/endpointing, mic, audio playback
      settings.js settings.css  # settings form + Test voice
  test/
    problems.test.ts    # bank integrity: every problem resolves to a real skeleton
    endpointing.test.ts # ported adaptive-endpointing math (800–5000ms, default 2500)
    prompt.test.ts      # systemPrompt build (name/pronoun/problem)
    openai.test.ts      # request shape via mocked fetch (models, params, headers)
```

Commands exist only as internal IDs behind buttons and the status-bar item; they are
`enablement`-guarded / hidden from the palette where practical.

## Error handling / edge cases

- **No key**: any interview action with no key in SecretStorage → banner in the Sam view
  ("Add your OpenAI key in ⚙ Settings") and a nudge to open the settings page.
- **OpenAI HTTP error**: surface `error.message` in a transcript system line; failed
  chat turn is popped so history stays valid.
- **Mic denied/unavailable**: banner, fall back to typing (voice output still works).
- **Transcription empty**: don't send; re-arm if hands-free.
- **Neural TTS fails**: fall back to the webview's browser speech synthesis.
- **End mid-request**: in-flight work is abandoned (token/guard pattern from the web
  app) and the view returns home without a late bubble.
- **Editor closed**: if `Solution.java` was closed, Share code / turns read the last
  known text; host warns if the document is gone.

## Testing approach

**Automated (CI-able in this environment):**
- Unit tests (above): problem-bank integrity, adaptive endpointing, prompt building,
  OpenAI request shape with mocked `fetch`.
- `tsc --noEmit` clean compile; successful `vsce package` producing a `.vsix`.

**Manual (documented for the user):**
- `F5` → Extension Development Host. Reveal the panel via the status-bar button, open
  ⚙ Settings, paste a real key, Save. Pick a problem, Start, verify: file + problem
  preview open; speak a turn → transcription → Sam replies in text + voice → mic
  re-arms; Hint / Share code / End work; settings persist across a reload.

## Distribution

- `vsce package` → side-loadable `.vsix` (Extensions → Install from VSIX…).
- Marketplace publishing deferred to a later iteration.
