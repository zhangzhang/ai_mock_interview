# Onsite mock interview room — full OpenAI stack (brain, transcription, voice), single key

Date: 2026-07-06
File under change: `mock-interview-room.html` (single-file app, no build step)

## Problem

The app needs two API keys (Anthropic for the brain, OpenAI for voice) and uses the
browser's Web Speech API for voice input, which is Chrome-only and flaky. The goal
is a single OpenAI key powering the whole stack — brain, voice input, voice output —
with model dropdowns, while staying a zero-backend static file.

## Decision on "realtime"

OpenAI's Realtime API (streaming speech-to-speech, `gpt-realtime`) requires a
backend: WebSocket auth can't set an `Authorization` header from the browser, and
WebRTC needs a server to mint ephemeral session tokens from the real key. That breaks
the "open the file, paste your key" model. **Decision: stay static and use plain REST
models** — chat completions, `/v1/audio/transcriptions`, `/v1/audio/speech`. Realtime
is explicitly out of scope (a separate, server-backed project if ever wanted).

## Goals

1. One OpenAI key for everything (brain + transcription + TTS).
2. **Brain** on OpenAI GPT-5-family chat completions, with a model dropdown.
3. **Voice input** via OpenAI transcription models (replacing the browser Web Speech
   recognizer), with a transcription-model dropdown; hands-free auto-send preserved.
4. **Voice output** via `gpt-4o-mini-tts` with the newest voices, browser voice kept
   as a free fallback; voice-model and voice dropdowns.
5. Key stays only in the page, with a visible note saying so.
6. Session behavior unchanged (Start resets; refresh resets; continuous within a run).

## Non-goals

- No backend, no build step, no Realtime API, no streaming speech-to-speech.
- No persistence of key/settings across reloads (in-memory only — explicit guarantee).
- No change to the persona, problem set, editor, interviewer name/pronoun, or the
  draggable divider.

## Design

### 1. Brain — GPT-5 chat completions

`ask(userContent)`:

- `POST https://api.openai.com/v1/chat/completions`, headers `Content-Type:
  application/json` + `Authorization: Bearer <key>`.
- Body:
  ```
  {
    model: <bot model>,                 // GPT-5 family (see §2)
    messages: [ {role:"system", content: systemPrompt()}, ...conversation ],
    max_completion_tokens: 2000,        // NOT max_tokens; reasoning tokens count here
    reasoning_effort: "low"             // fast, short spoken turns; supported by all
  }                                     //   models offered in §2
  ```
  GPT-5 are reasoning models: `temperature` is **omitted** (rejected), `max_tokens`
  becomes `max_completion_tokens`, and `reasoning_effort:"low"` keeps latency down.
- Text from `data.choices?.[0]?.message?.content` (trimmed); empty/`length`-truncated
  → existing "Sorry — could you say that again?" fallback.
- Errors from `data.error?.message`.
- The two-branch (user-key vs claude.ai proxy) logic collapses to one path: always
  use the OpenAI key. Empty key → catch shows a banner pointing to Settings. Remove
  the `anthropic-*` headers.
- Refs: [GPT-5 reasoning params](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning),
  [GPT-5.5 guide](https://developers.openai.com/api/docs/guides/latest-model).

### 2. Single key + Bot-model dropdown (Connection section)

- Connection's two inputs (`#apiKey` Anthropic key, `#apiModel` text) become: one
  **OpenAI API key** input (id kept `apiKey`, repurposed, `type="password"`,
  placeholder "OpenAI API key (sk-…)"), plus **Bot model** `<select id="botModel">`:
  `gpt-5.5` (default, flagship), `gpt-5`, `gpt-5-mini`, `gpt-5-nano`. No 4.x.
- `ask()` reads `#botModel` (default `gpt-5.5`). All three OpenAI features read the
  one `#apiKey`.
- The separate `#openaiKey` field in the Voice→Neural row is **removed**.

### 3. Voice input — OpenAI transcription (replaces Web Speech)

The browser `SpeechRecognition` machinery (`recog`, its handlers, and the interim-
result pause timer) is removed and replaced with record → detect-pause → transcribe:

- **Capture:** acquire the mic once via `getUserMedia({audio:true})` and reuse the
  stream for the whole session (also permanently fixes the per-turn mic re-prompt).
  A `MediaRecorder` records `audio/webm` chunks per turn.
- **Pause detection (hands-free):** a Web Audio `AnalyserNode` on the same stream is
  polled (~every 100ms) for RMS volume. Track `heardSpeech` (volume crossed a speech
  threshold at least once). Once `heardSpeech`, if volume stays below a silence
  threshold for `PAUSE_MS` (1200ms), auto-stop the recorder. Manual mic click stops
  it immediately.
- **Transcribe:** on `MediaRecorder.onstop`, assemble the blob and
  `POST https://api.openai.com/v1/audio/transcriptions` as `multipart/form-data`
  with `file` (the webm blob), `model` (from the transcription dropdown),
  `response_format:"json"`, `Authorization: Bearer <key>`. Read `data.text`.
- **Send:** put the text in `#textInput` and call `sendSpoken()`. Empty text (no
  speech / empty transcript) → don't send; re-arm if hands-free.
- **Presence states:** "listening…" while recording, "transcribing…" during the API
  call, then back to the normal flow. Hands-free re-arms after the interviewer's TTS
  ends, as today.
- **Transcription-model dropdown** `<select id="sttModel">` in a new "Your voice
  (input)" settings section: `gpt-4o-transcribe` (default, best), `gpt-4o-mini-
  transcribe` (faster/cheaper), `whisper-1` (legacy). Read fresh each turn.
- **Trade-offs (accepted):** no live interim captions (text appears after
  transcription) and higher per-turn latency than browser STT (record → upload →
  transcribe → chat → TTS). In exchange: cross-browser (any browser with
  MediaRecorder, not just Chrome) and better accuracy. A "transcribing…" indicator
  covers the gap.
- **Failure handling:** mic blocked/denied → banner + fall back to typing (as today).
  Transcription HTTP error → note the error, re-arm/allow typing; the turn isn't sent.

### 4. Voice output — newest TTS voices

- `#openaiModel` (voice model) stays: `gpt-4o-mini-tts` (default), `tts-1-hd`,
  `tts-1`. (No newer `/v1/audio/speech` model exists; `gpt-4o-mini-tts` is newest.)
- `#openaiVoice` gains the newest voices: add `verse`, `marin`, `cedar` (best
  quality, `gpt-4o-mini-tts`-only) to the existing list. Note in the UI that
  `marin`/`cedar`/`verse`/`ballad` require `gpt-4o-mini-tts`; on a mismatch the
  existing TTS-error path already falls back to the browser voice.
- Browser voice remains a free, no-key fallback via the Browser/Neural toggle.
- `speakNeural()`/`speak()` read the unified `#apiKey` (not the removed `#openaiKey`).
- Voices verified: [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech).

### 5. Settings layout

Modal sections, in order:
1. **Connection** — OpenAI API key, Bot model, privacy note (§6).
2. **Interviewer** — name, pronoun (unchanged; pronoun→voice mapping unchanged).
3. **Your voice (input)** — Transcription model.
4. **Interviewer voice (output)** — Browser/Neural toggle, speed, voice picker,
   voice model.

### 6. Key privacy note

Under the key field, a muted line: **"Your key stays in this browser tab only —
never saved, and sent only to OpenAI."** Guarantee: the key is read from `.value`
at call time and used only in `Authorization` headers; no `localStorage`,
`sessionStorage`, or `cookie` anywhere (grep-verified at implementation).

### 7. Copy & visibility cleanup

- All "Anthropic"/"Claude" user-facing text → "OpenAI" (boot banner, `ask()` error
  banner, top HTML comment "powered by Claude" → "powered by OpenAI").
- Connection section is **always shown** (an OpenAI key is always required); remove
  the embedded-mode `connectionSection` hide. Embedded-frame mic banner unchanged.

### 8. Session behavior

Unchanged: `startInterview()` clears `conversation`; it accumulates and is re-sent in
full each turn; Start / refresh reset.

## Error handling / edge cases

- Empty key + turn → banner to add the OpenAI key in Settings; failed turn popped
  from `conversation` (existing).
- Mic denied → banner, type instead (existing pattern, now around getUserMedia).
- MediaRecorder unsupported → disable the mic, note that typing works; voice output
  still functions.
- Transcription/chat/TTS HTTP errors → surface `error.message`; graceful fallback
  (typing for input; browser voice for output).
- Newer voice + legacy model mismatch → TTS error path falls back to browser voice.

## Testing approach

Manual, in Chrome served over `http://localhost` (no test harness):

1. Settings shows: Connection (OpenAI key + Bot model default `gpt-5.5` + privacy
   note), Interviewer, Your voice (input: transcription model default
   `gpt-4o-transcribe`), Interviewer voice (output). No second key field anywhere.
2. With a valid key, start an interview → intercept requests: chat hits
   `/v1/chat/completions` with the GPT-5 model, a leading system message, accumulated
   history, `max_completion_tokens`, `reasoning_effort:"low"`, no `temperature`.
3. Speak a sentence hands-free → recorder stops on pause → request hits
   `/v1/audio/transcriptions` with the chosen STT model → transcribed text is sent →
   interviewer replies → TTS plays → mic re-arms. Manual mic click also stops+sends.
4. Change Bot model / Transcription model / Voice + voice-model dropdowns → next
   requests use the new values; `marin`/`cedar` play on `gpt-4o-mini-tts`.
5. Browser voice (no-key path for output) still works.
6. Grep the file: no `localStorage`/`sessionStorage`/`cookie`; no `anthropic`/
   `claude`/`SpeechRecognition`/`webkitSpeechRecognition` residue.
7. Conversation stays continuous across turns; resets on Start / refresh.
