# Onsite — AI mock interview room

A voice-driven mock coding-interview room in a **single, static HTML file**. On the
left is a problem sheet; on the right, a Java editor and your interviewer, **Sam**.
Sam (powered by OpenAI) speaks to you, listens to you reason out loud, and sees the
code in your editor — like a real onsite.

The page itself is static (no build step), and your OpenAI API key lives only in the
browser tab. One catch: **OpenAI's API can't be called directly from a browser** (it
sends no CORS header), so you deploy a tiny one-file proxy — a free Cloudflare Worker —
that relays your requests to OpenAI. Your key transits only your own proxy; it is never
stored. See [Set up the proxy](#set-up-the-proxy-required) below.

**▶ Try it live: https://zhangzhang.github.io/ai_mock_interview/**
(you'll need your own key **and** a proxy URL — see below)

## Features

- **Talk it through out loud.** Push the mic, think aloud, and Sam responds by voice.
  Hands-free: it detects when you pause, transcribes what you said, and sends it —
  then re-arms after Sam replies so you can keep going without clicking.
- **Sam sees your code.** Each turn sends a snapshot of your editor, so Sam reacts to
  what you actually wrote — nudging with questions rather than handing you answers.
- **Full OpenAI stack, one key:**
  - **Brain** — Chat Completions (`gpt-5.6` default; `gpt-5.5`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`).
  - **Your voice → text** — transcription (`gpt-4o-transcribe` default; `gpt-4o-mini-transcribe`, `whisper-1`).
  - **Sam's voice** — neural `gpt-4o-mini-tts` with the newest voices (marin, cedar, verse, …)
    on by default, or a free built-in **browser voice** that needs no key.
- **Configurable interviewer** — set the name and pronouns; the pronoun also picks a
  matching default voice.
- **Adjustable speech speed**, a **resizable divider** between the problem and editor
  panes, and a syntax-highlighted Java editor (CodeMirror).
- **A curated problem bank** (Java): ~180 LeetCode problems grouped by the 15 core
  interview patterns (Arrays & Hashing, Two Pointers, Sliding Window, Stack, Binary
  Search, Linked List, Trees, Tries, Heaps, Backtracking, Graphs, Intervals, Greedy,
  DP, Bit/Math), plus a company **"Amazon"** group at the top of the picker for
  Amazon-frequent questions. Each shows a short original summary, a real Java starter
  signature, and a reference link; the picker is grouped so you can drill one pattern
  (or company) at a time.

## Getting started

The app is hosted on GitHub Pages — no install needed:

**→ https://zhangzhang.github.io/ai_mock_interview/**

You need two things: an **OpenAI API key** (create one at
[platform.openai.com](https://platform.openai.com/api-keys)) and a **proxy URL** (see
the next section — it's a 2-minute, free, one-time setup). Open the page in Chrome, open
Settings (⚙), paste both, and you're ready. The hosted page is served over HTTPS, so the
microphone works and its permission is remembered.

## Set up the proxy (required)

OpenAI's API sends no CORS header, so **a browser cannot call `api.openai.com`
directly** — every request (the interviewer's brain, transcription, and the neural
voice) is blocked. The fix is a tiny relay you host yourself. The repo ships one in
[`proxy/openai-proxy.js`](proxy/openai-proxy.js): it forwards your request to OpenAI,
passes your `Authorization` header through untouched, and adds the CORS header the
browser needs. It never stores, logs, or inspects your key.

**Deploy it free on Cloudflare Workers.** Two ways — pick one:

**A. Dashboard (inline editor — paste, don't upload).**

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** →
   **Create** → **Workers** → start from **"Hello World"**.
2. In the Worker's **inline code editor**, select all, delete, and paste the full
   contents of `proxy/openai-proxy.js` → **Deploy**.
   *(Don't use the drag-and-drop file upload/import — it rejects raw Worker scripts
   with "requires a build process". Paste into the editor instead, or use option B.)*
3. (Recommended) edit `ALLOWED_ORIGINS` in the code to your page's origin(s) — e.g.
   `["https://zhangzhang.github.io", "http://localhost:8731"]` — and redeploy, so only
   your page can relay through it.
4. Copy the worker URL (`https://<name>.<you>.workers.dev`) and paste it into the
   **Proxy URL** field in the app's Settings.

**B. Wrangler CLI.**

```bash
cd proxy
npx wrangler login     # opens a browser once to authorize
npx wrangler deploy    # uses wrangler.toml; prints your worker URL
```

Then paste the printed URL into **Proxy URL** in Settings.

> Any OpenAI-compatible proxy works — if you already run one, just point **Proxy URL**
> at it. Leave the field blank only if you're serving the page from a same-origin
> backend that itself relays to OpenAI.

### Running it locally (for development)

It's a single static file, so any static server works. **Serve it over `http://localhost`** —
don't just double-click the file, because opening from a `file://` URL blocks the
microphone (and re-prompts every turn).

```bash
git clone git@github.com:zhangzhang/ai_mock_interview.git
cd ai_mock_interview
python3 -m http.server 8731
# then open http://localhost:8731/ in Chrome
```

You still need the proxy (above) even locally — add `http://localhost:8731` to the
worker's `ALLOWED_ORIGINS`. Chrome is recommended.

## How to use

### 1. Configure it once (Settings ⚙)

Click the **⚙ gear** in the top bar to open Settings. On first run it opens
automatically. Fill in:

- **Connection** — paste your **OpenAI API key**, your **Proxy URL** (see
  [Set up the proxy](#set-up-the-proxy-required)), and choose the **interviewer model**
  (`gpt-5.6` is the default; `gpt-5.5`/`gpt-5` are alternatives, `gpt-5-mini`/`gpt-5-nano`
  are cheaper and faster).
- **Interviewer** — set Sam's **name** and **pronouns** (these personalize how the
  interviewer refers to itself and pick a matching default voice).
- **Your voice (input)** — the **transcription model** for turning your speech into
  text (`gpt-4o-transcribe` is most accurate; `gpt-4o-mini-transcribe` is faster).
- **Interviewer voice (output)** — **Neural · OpenAI** (higher quality) is on by
  default; you can switch to **Browser voice** (free, no key). For OpenAI, choose a voice (marin/cedar are
  the best-quality newest ones) and the TTS model, and set the **speech speed**.
  Use **Test voice** to hear it.

Close Settings with the ✕, the Esc key, or by clicking outside the panel.

### 2. Pick a problem and start

Choose a problem from the dropdown in the top bar, then press **Start interview**.
Sam greets you, states the problem, and invites clarifying questions. The Java editor
is pre-filled with a starter class.

### 3. Talk through it (or type)

You can respond two ways:

- **By voice (recommended):** click the **🎤 mic**. Talk out loud; when you pause,
  it automatically transcribes what you said and sends it — then the mic re-arms after
  Sam replies, so you can keep the conversation going hands-free. Click the mic again
  any time to stop and send immediately, or to drop back to typing.
  *(Allow the microphone when the browser asks — just once, on `http://localhost`.)*
- **By typing:** type in the input box and press Enter or **Send**.

Write your solution in the editor as you go — Sam sees a snapshot of your code with
every turn and reacts to it.

### 4. Use the helper buttons

| Button | What it does |
| --- | --- |
| **🎤 mic** | Start/stop talking (hands-free voice input) |
| **Send** | Send what's in the text box |
| **Share code** | Ask Sam to look at your current editor code and react |
| **Hint** | Ask for the smallest useful nudge (never the full answer) |
| **End & feedback** | Wrap up and get an honest assessment of your performance |
| **End session** | Stop the interview immediately (halts voice and any pending reply) |
| **🔊 / 🔇** | Mute or unmute Sam's voice |

### 5. Wrap up

Press **End & feedback** to have Sam give you a short, honest review — what was strong
and one or two things to work on. **End session** (or a page refresh) resets for a
fresh run. Tip: a refresh always starts a brand-new conversation.

## Privacy

Your OpenAI key lives only in the page's input field, in memory, for the browser tab.
It is never written to `localStorage`, `sessionStorage`, or cookies. It is sent only in
the `Authorization` header of your own API calls, which travel through **your own
proxy** (the Cloudflare Worker you deploy) to OpenAI — the proxy forwards the header
untouched and never stores or logs it. Close or refresh the tab and the key is gone.
The Proxy URL you enter is also in-memory only, for the tab.

## How it works

`mock-interview-room.html` is the entire app — vanilla HTML/CSS/JS with two CDN
dependencies (CodeMirror for the editor). Voice input records the mic with
`MediaRecorder` and detects end-of-speech with a small Web Audio VAD using **adaptive
endpointing**: rather than one fixed silence timeout, the end-of-turn pause adapts
within 800–5000 ms (starting at 2500 ms) to your own mid-thought pauses — snappier if
you speak in quick bursts, more patient if you tend to pause and think — then
transcribes the clip via `/v1/audio/transcriptions`. The interviewer runs on `/v1/chat/completions`
(the full conversation is re-sent each turn, so context is continuous within a
session). Sam's voice uses `/v1/audio/speech`, with the browser's speech synthesis as
a free fallback. All three calls go to `<Proxy URL>/v1/...` instead of
`api.openai.com` directly, because browsers can't reach OpenAI cross-origin (CORS) —
see [Set up the proxy](#set-up-the-proxy-required).

The conversation is one continuous session per run: **Start interview** begins a fresh
session and a page refresh resets it.

> **Note:** True streaming, speech-to-speech "realtime" voice isn't included — that
> needs OpenAI's Realtime API, which requires a small backend to mint session tokens
> and so can't run from a purely static file.

## Design docs

Specs and implementation plans for the major features live in
[`docs/superpowers/`](docs/superpowers/).

## License

[MIT](LICENSE)
