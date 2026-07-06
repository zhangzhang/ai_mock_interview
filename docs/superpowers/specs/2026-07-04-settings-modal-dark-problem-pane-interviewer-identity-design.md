# Onsite mock interview room — settings modal, dark problem pane, interviewer identity

Date: 2026-07-04
File under change: `mock-interview-room.html` (single-file app, no build step)

## Problem

The settings UI (Anthropic/OpenAI keys, voice picker, speed control), added in the
previous redesign, lives inline in the dock as a `#settingsDrawer` that auto-folds
into a persistent status chip — that chip still permanently occupies dock space
that should go to the transcript. Separately, the problem pane (`.problem`) uses a
light "paper" background while every other panel in the app (editor, dock, topbar)
is dark — originally a deliberate light/dark contrast, now to be unified into the
dark theme. Finally, the interviewer is hardcoded as "Sam" everywhere (system
prompt, dock label, transcript tags) with no way to customize the name or pronouns
Sam uses to refer to themself.

## Goals

1. Move all settings (Connection, Voice, and the new Interviewer section) into a
   true modal dialog, opened/closed by a single top-bar button. No inline drawer,
   no persistent status chip — the dock is 100% transcript + talkbar when the modal
   is closed.
2. Recolor the problem pane to match the dark theme used everywhere else, reusing
   existing `:root` custom properties (no new colors).
3. Replace the free speed slider with a fixed-preset dropdown: 0.5x, 1x, 1.5x, 2x,
   2.5x (default 1x).
4. Add an "Interviewer" section to the settings modal: a name field (default
   "Sam") and a pronoun select (They/Them, She/Her, He/Him — default They/Them).
   Both flow into the system prompt and every UI spot that currently hardcodes
   "Sam", and lock once an interview is live (same pattern as the problem picker).

## Non-goals

- No change to interview logic, problem set, or editor beyond what's listed above.
- No auto-selection of a "matching" voice based on pronoun — voice picking stays
  fully independent and manual, as today.
- No persistence of settings across page reloads (unchanged from today).
- No change to hands-free voice pause detection, fold timers, or STT/TTS core
  logic beyond swapping the speed control's input type.

## Design

### 1. Settings modal

Replace `#settingsDrawer` (a `<div>`) with `#settingsModal` (a native `<dialog>`
element, class `.settings-modal`), containing a small header ("Settings" + a ✕
close button) followed by three `.modal-section` blocks in order: **Connection**,
**Interviewer**, **Voice** — same fields as today's Connection/Voice sections, plus
the new Interviewer section (below). The `.drawer`/`.drawer-section`/`.drawer-label`
classes are renamed `.settings-modal`/`.modal-section`/`.modal-label` to match the
new component (same visual treatment: bordered card, section dividers, amber dot
labels — carried over from the prior polish pass).

The top-bar button (`#voiceBtn`) keeps its existing `id` and `title="Settings"`
but its icon changes from 🎙 to ⚙. Clicking it calls `settingsModal.showModal()`
when closed or `settingsModal.close()` when open. The dialog also closes via its ✕
button, a backdrop click (clicking the dimmed area outside the dialog's box), or
the browser's native Escape-to-close behavior — all three routes end in the same
native `close` event, which is the single place that un-highlights the ⚙ icon.

**Auto-open behavior:** in local (non-embedded) mode, the modal auto-opens on page
load via `showModal()`, exactly like today's drawer, since a key is required. In
embedded/claude.ai mode it stays closed on load (the Connection section is hidden
there, same as today) — the user opens it via ⚙ only if they want to change voice
or interviewer settings.

**Removed entirely:** the status chip (`#chipRow`, `#chipText`, `#editSettings`)
and all of the one-time auto-fold machinery built for it (`drawerAutoFoldArmed`,
`foldOnce()`, `armVoiceAutoFold()`, `openDrawer()`, `closeDrawerToChip()`,
`updateChip()`, and the `#apiKey` input listener that triggered the fold). None of
this is needed once settings live in a modal that's either fully open or fully
closed — there's no intermediate "folded summary" state to maintain.

### 2. Problem pane → dark theme

Remove the `--paper`, `--paper-ink`, `--paper-soft`, `--paper-line` custom
properties from `:root` (nothing else references them once this lands) and
recolor every rule under `.problem` to reuse existing dark-theme tokens:

- `.problem` background/text: `var(--panel)` / `var(--text)` (matching
  `.editor-head`'s panel tone).
- `.problem .eyebrow` and `.problem .body h4`: `var(--muted)` (matching the
  eyebrow/label convention used in `.modal-label` and `.who small`).
- `.problem .body` and `.problem .body strong`: `var(--text)`.
- `.problem .body pre`: background `var(--panel-2)`, border `var(--line)`, text
  `var(--text)` — the same panel-on-panel contrast the editor gutter uses.
- Difficulty/pattern chips reuse the already-declared-but-unused `--green` and
  `--red` root tokens for `.chip.easy` / `.chip.hard` (soft-opacity backgrounds,
  solid-color text, same pattern as `--amber-soft`/`--indigo-soft` elsewhere);
  `.chip.medium` reuses `--amber-soft`/`--amber-2`; `.chip.pattern` reuses
  `--panel-2`/`--muted`. No new colors are introduced anywhere in this change.

### 3. Speed control → preset dropdown

Replace the `#speedRange` range input (and its `#speedLabel` companion span) with
a single `<select id="speedSelect">` offering exactly five options — 0.5x, 1x,
1.5x, 2x, 2.5x — value-matched to `0.5`/`1`/`1.5`/`2`/`2.5`, with `1` selected by
default. A `change` listener sets `speechRate` from the selected value, replacing
today's `input` listener on the range control. `speechRate` itself, and everything
that reads it (`speakBrowser`'s `u.rate`, `speakNeural`'s `body.speed` /
pace-hint-instructions logic), is unchanged — only the control that sets it
changes shape. The dropdown sits in the same `.vrow.speed-row` slot the slider
occupied, styled by the same `.vpanel select` rule other voice-section selects
already use (no bespoke CSS needed).

### 4. Interviewer name & pronouns

New `#interviewerSection` (a `.modal-section` between Connection and Voice) with
two controls: a text input `#interviewerName` (default value `Sam`, placeholder
"Interviewer's name", `maxlength="30"`) and a select `#interviewerPronoun` with
options They/Them (`they`, selected by default), She/Her (`she`), He/Him (`he`).

Two module-level variables track the current values: `interviewerName` (raw input
value, may be empty while the user is mid-edit) and `interviewerPronoun` (default
`"they"`). A helper `interviewerDisplayName()` returns `interviewerName.trim() ||
"Sam"` — the single source of truth for anywhere the name is displayed or sent to
the model, so a temporarily-empty input never breaks the transcript or system
prompt.

Consumers of these values:
- **System prompt:** `SYSTEM_BASE` (currently a static `const` string with "Sam"
  and no pronoun reference) becomes a `systemBase()` function that interpolates
  `interviewerDisplayName()` everywhere "Sam" previously appeared literally
  (opening line and closing "Stay Sam" line), and adds one clause translating
  `interviewerPronoun` into a `they/them` / `she/her` / `he/him` phrase the model
  is told to use if its pronouns ever come up naturally. `systemPrompt()` calls
  `systemBase()` instead of referencing the old constant.
- **Dock label:** the hardcoded `<b>Sam</b>` in `.who` becomes
  `<b id="interviewerNameLabel">Sam</b>`, updated on every `#interviewerName`
  `input` event.
- **Transcript tags:** `addMsg()`'s `who==="sam"?"Sam":"You"` becomes
  `who==="sam"?interviewerDisplayName():"You"` — read live at message-append time,
  so it reflects whichever name was active when that turn was sent (stable through
  a session because of the lock below).
- **Internal role key:** the `"sam"` string used as `who` (for the `.msg.sam` CSS
  class and the `addMsg`/`speak` call sites) is an internal identifier, not a
  display string — it stays `"sam"` regardless of the configured name.

**Locking during a live interview:** `#interviewerName` and `#interviewerPronoun`
are disabled in `startInterview()` and re-enabled in `endInterview()`, exactly
mirroring how `problemSelect` is already locked — changing the interviewer's
identity mid-conversation would be a continuity break, same reasoning as not
letting the candidate swap problems mid-interview.

## Error handling / edge cases

- Clearing the name field to empty never breaks anything: `interviewerDisplayName()`
  falls back to "Sam" for the system prompt and transcript, while the input itself
  is free to sit empty until the user types something (or leaves it empty, in
  which case Sam answers to "Sam" throughout).
- The Connection section's visibility rule (hidden when embedded in claude.ai)
  is unchanged — this branch only moves it into the new modal wrapper.
- Backdrop-click-to-close only fires when the click target is the `<dialog>`
  element itself (i.e., outside the content box) — clicks on any control inside
  the modal do not close it, since their target is a descendant, not the dialog.
- If `<dialog>` isn't supported in some future non-Chrome context, `showModal`
  simply won't do anything visually; per this project's existing "works best in
  desktop Chrome" scope, no polyfill or fallback is added.

## Testing approach

Manual verification in Chrome, per this project's existing constraint (no test
harness exists for this static file):

1. Load locally: confirm the settings modal auto-opens with Connection,
   Interviewer, and Voice sections visible, dimmed backdrop behind it, ⚙ icon
   highlighted. Click ✕, click the backdrop, and press Escape (in three separate
   reloads) — confirm each closes the modal and un-highlights ⚙. Confirm no chip
   or inline drawer ever appears in the dock.
2. Confirm the problem pane now renders on a dark background matching the editor
   fen/dock tone, with legible chips (easy/medium/hard/pattern) and code blocks.
3. Open the Voice section, confirm the speed control is a 5-option dropdown
   (0.5x/1x/1.5x/2x/2.5x), and that Test Voice at 0.5x and 2.5x audibly changes
   pace for both Browser and Neural modes (Neural check optional without a key).
4. Change the interviewer name to e.g. "Alex" and pronoun to He/Him: confirm the
   dock label updates immediately, start an interview and confirm the transcript
   tags Sam's replies as "Alex", and (if a key is available) confirm Sam
   introduces themself consistent with the new name. Confirm both fields are
   disabled while the interview is live and re-enabled after ending it.
