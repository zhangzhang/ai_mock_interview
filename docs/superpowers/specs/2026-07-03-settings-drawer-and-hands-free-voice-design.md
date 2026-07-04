# Onsite mock interview room — settings drawer, speech speed, hands-free voice

Date: 2026-07-03
File under change: `mock-interview-room.html` (single-file app, no build step)

## Problem

The Anthropic/OpenAI API key setup UI (`.keyrow` + `.vpanel`) is always visible once
opened, permanently eating dock space that should go to the chat transcript. There's
no way to control how fast Sam speaks. Voice input requires a second manual click
(push mic to start, push again to stop-and-send) instead of detecting a natural pause
in speech and sending automatically.

## Goals

1. Fold the API key / voice setup UI out of the way once configured, without losing
   easy access to edit it later.
2. Let the user control Sam's speech playback speed, for both browser TTS and OpenAI
   neural TTS.
3. Auto-detect a pause after the user stops talking and automatically send the
   transcribed text — no second click required — and re-arm listening after Sam
   replies so the whole exchange can be hands-free.
4. Apply visual redesign (via the frontend-design skill, at implementation time) so
   the consolidated settings area reads as an intentional, polished component rather
   than stacked default form inputs.

## Non-goals

- No changes to the interview logic/system prompt, problem set, or editor.
- No server-side component — this stays a static, client-only HTML file.
- No persistence of settings across page reloads (matches current behavior — keys
  and preferences live only in page state for the session).

## Design

### 1. Unified settings drawer

Replace the two independent UI blocks (`#keyrow`, `#vpanel`) with a single
`#settingsDrawer` component containing two labeled sections:

- **Connection** — Anthropic API key input + model input (same fields as today's
  `#apiKey` / `#apiModel`).
- **Voice** — TTS mode segmented control (Browser / Neural · OpenAI), the new speed
  slider, the existing browser-voice `<select>` or OpenAI voice/model selects +
  OpenAI key input (shown/hidden based on mode, as today), and the "Test voice"
  button.

The existing 🎙 icon button in the top bar becomes the single toggle for this drawer
(retitled "Settings" via its `title` attribute). It replaces its current role of
toggling only the voice panel.

The drawer is presentational — it doesn't change how `ask()`, `speak()`, or
`startListening()` read their inputs; those functions keep reading the same element
IDs (`apiKey`, `apiModel`, `openaiKey`, etc.), which move inside the new drawer
markup unchanged.

### 2. Fold / collapse behavior

- On page load, the drawer opens exactly when it does today (local/non-embedded run
  shows it open with the existing banner copy; embedded-in-claude.ai run keeps the
  Connection section irrelevant/hidden since the proxy handles auth, but Voice
  section still applies).
- The Anthropic key `<input>` gets an `input` listener: the first time its trimmed
  value becomes non-empty, the drawer auto-collapses into a compact status chip row,
  e.g.:
  `✓ Claude connected · Browser voice · 1.0x   [Edit]`
  The chip's middle segment reflects current TTS mode + label, and the speed value
  updates live from the slider even while collapsed.
- If the app is running embedded in claude.ai (no key needed), the drawer instead
  auto-collapses on the first `change`/`input` event from any Voice control (TTS
  mode toggle, speed slider, voice/model select, or the Test voice button), same
  chip pattern minus the "Claude connected" segment (e.g. `Browser voice · 1.0x
  [Edit]`).
- Clicking **Edit** in the chip, or clicking the 🎙 icon again, re-expands the full
  drawer. Re-collapsing only happens automatically once per "first key entered"
  transition — after that, open/closed is fully manual via the icon/Edit control.
- Folding is purely a CSS/display concern; no state is destroyed when collapsed
  (inputs keep their values).

### 3. Speech speed control

- New slider `#speedRange` (range input, min 0.5, max 2.0, step 0.1, default 1.0) in
  the Voice section, with a live numeric label (e.g. "1.0x").
- A module-level `speechRate` variable (default `1.0`) is updated on the slider's
  `input` event and used by:
  - `speakBrowser()`: sets `u.rate = speechRate` (replacing the current hardcoded
    `1.02`).
  - `speakNeural()`: for `tts-1` / `tts-1-hd`, sets `body.speed = speechRate` (native
    OpenAI param, valid range 0.25–4.0, our slider's 0.5–2.0 is a safe subset). For
    `gpt-4o-mini-tts` (which has no numeric speed param), append a pace clause to
    `body.instructions` based on which side of 1.0 the value falls on — e.g. below
    0.85 appends "Speak at a noticeably slower, more deliberate pace.", above 1.15
    appends "Speak at a noticeably brisker pace.", otherwise no addition.
- The status chip's speed segment reflects `speechRate` live.

### 4. Hands-free pause detection

- New state: `handsFree` (bool, default false) and `silenceTimer` (timeout handle).
- Clicking the mic button when idle: sets `handsFree = true`, calls
  `startListening()` as today.
- In `recog.onresult`, after updating `heard`/interim text as today, clear and reset
  `silenceTimer` to fire after **1200ms**. If it fires and `heard.trim()` is
  non-empty, call a new `autoSend()` path: stop recognition (`stopListening()`) and
  call `sendSpoken()` — same as today's manual mic-click-to-stop-and-send.
- Clicking the mic button while `listening === true` (manual interrupt) sets
  `handsFree = false` and behaves as today (stop + send immediately), fully exiting
  hands-free mode.
- `onSpeechEnd()` (fired when Sam's TTS finishes) gains a check: if
  `interviewLive && handsFree && !listening`, call `startListening()` again after a
  short beat (e.g. 300ms, to avoid capturing the tail of Sam's audio) so the user can
  keep talking without touching the mic again.
- `endInterview()` resets `handsFree = false` and clears any pending `silenceTimer`.
- The 1.2s threshold is a fixed constant (`PAUSE_MS = 1200`), not user-configurable,
  per the agreed scope.

### 5. Visual redesign

Applied at implementation time using the frontend-design skill's guidance: spacing,
type hierarchy, and treatment of the drawer/chip so the consolidated settings area
looks like a designed component (card structure, clear section labels, consistent
control sizing) rather than the current stacked-inputs-in-a-box look. This is
execution polish layered on top of the structural changes above — it does not change
any of the behaviors described in sections 1–4.

## Error handling / edge cases

- If the Anthropic key is cleared back to empty after being set (user edits it
  manually via Edit), the drawer does not re-auto-collapse on its own again — user
  controls open/closed manually from that point (avoids fighting the user while
  they're actively editing).
- If OpenAI TTS request fails (as today), it falls back to browser voice — the
  speed value still applies to that fallback call.
- If `SpeechRecognition` isn't supported at all (`sttOK === false`), hands-free mode
  never engages (mic button stays disabled, unchanged from today).
- If the user starts typing in the text input while hands-free listening is active,
  no special handling is added beyond what exists today — voice text and typed text
  both flow through the same `#textInput` element as today's model already assumes.

## Testing approach

Manual verification in Chrome (per this project's existing "works best in desktop
Chrome" constraint — no test harness exists for this static file):

1. Load locally, confirm drawer is open, confirm it collapses on first Anthropic key
   keystroke, confirm chip shows correct summary, confirm Edit reopens it.
2. Drag speed slider, use Test voice at 0.5x/1.0x/2.0x for both Browser and Neural
   modes, confirm audible rate changes.
3. Start an interview, click mic once, speak a sentence, stop talking, confirm
   auto-send fires ~1.2s later without a second click, confirm mic re-arms after
   Sam's reply finishes speaking.
4. Click mic to manually interrupt mid-listen, confirm it still sends immediately
   and hands-free mode turns off (doesn't auto re-arm after that reply).
