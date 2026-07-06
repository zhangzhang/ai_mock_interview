# Settings Modal, Dark Problem Pane & Interviewer Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all settings into a native `<dialog>` modal opened by a ⚙ top-bar button (removing the inline drawer + status chip), recolor the problem pane to the dark theme, swap the speed slider for a preset dropdown, and add a customizable interviewer name + pronoun.

**Architecture:** All changes are in the single static file `mock-interview-room.html` (no build step, no test framework). Tasks are ordered so the file stays loadable and working after every commit: dark problem pane first (pure CSS, independent), then the speed dropdown (small, self-contained), then the modal conversion (the largest markup+JS change, removes the chip/fold machinery), then the interviewer identity (builds on the modal being in place).

**Tech Stack:** Vanilla HTML/CSS/JS, native `<dialog>` element, Web Speech API, existing CodeMirror/Anthropic/OpenAI integrations (unchanged).

## Global Constraints

- Single file only: all changes in `mock-interview-room.html`. No build step, no package.json, no new external scripts.
- No automated test framework exists and none is added — verification is manual, in desktop Chrome.
- No new colors: every color must come from an existing `:root` custom property (`--ink`, `--panel`, `--panel-2`, `--line`, `--text`, `--muted`, `--amber`, `--amber-2`, `--amber-soft`, `--indigo`, `--indigo-soft`, `--green`, `--red`, `--mono`, `--ui`).
- Preserve element IDs consumed by JS unless the spec explicitly renames/removes them: `apiKey`, `apiModel`, `openaiKey`, `openaiVoice`, `openaiModel`, `voiceSel`, `ttsSeg`, `browserRow`, `neuralRow`, `testVoice`, `problemSelect`, `voiceBtn`, `muteBtn`, `startBtn`.
- Speed presets are exactly: 0.5x, 1x, 1.5x, 2x, 2.5x (values `0.5`/`1`/`1.5`/`2`/`2.5`), default `1`.
- Interviewer name default "Sam"; pronoun options They/Them (`they`, default), She/Her (`she`), He/Him (`he`).
- The internal role key `"sam"` (used for the `.msg.sam` CSS class and `addMsg`/`speak` call sites) stays literally `"sam"` — it is not a display string.

---

### Task 0: Feature branch

**Files:** none (git setup)

- [ ] **Step 1: Create a feature branch and stop tracking .DS_Store**

```bash
cd /Users/developer/workspace/interview
printf ".DS_Store\n" >> .gitignore
git add .gitignore docs/superpowers/specs/2026-07-04-settings-modal-dark-problem-pane-interviewer-identity-design.md
git commit -m "Add settings-modal spec and ignore .DS_Store"
git checkout -b settings-modal-interviewer-identity
```

- [ ] **Step 2: Verify**

Run: `git branch --show-current` → expect `settings-modal-interviewer-identity`. `git status` clean except untracked `.DS_Store`.

---

### Task 1: Dark problem pane

**Files:** Modify `mock-interview-room.html` — `:root` block (lines ~19-28) and the `.problem` CSS rules (lines ~62-80).

**Interfaces:**
- Produces: `.problem` and its children now use dark-theme tokens. No JS interface change.

- [ ] **Step 1: Remove the paper tokens from `:root`**

Find:

```css
    --text:#e6e7ea; --muted:#8b90a0;
    --paper:#e8e5db; --paper-ink:#23252d; --paper-soft:#63656f; --paper-line:#d3cfc2;
    --amber:#f2a63b; --amber-2:#ffbe5c; --amber-soft:rgba(242,166,59,.14);
```

Replace with:

```css
    --text:#e6e7ea; --muted:#8b90a0;
    --amber:#f2a63b; --amber-2:#ffbe5c; --amber-soft:rgba(242,166,59,.14);
```

- [ ] **Step 2: Recolor the `.problem` rules**

Find the entire block:

```css
  /* problem sheet */
  .problem{flex:0 0 40%;max-width:560px;background:var(--paper);color:var(--paper-ink);
    overflow:auto;padding:26px 30px 40px}
  .problem .eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--paper-soft);
    font-weight:700;margin-bottom:10px}
  .problem h2{font-size:24px;margin:0 0 12px;line-height:1.15;font-weight:750;letter-spacing:-.01em}
  .chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
    padding:3px 9px;border-radius:999px;margin-right:8px}
  .chip.easy{background:#cfe9d8;color:#1d6b45} .chip.medium{background:#f2e2c2;color:#8a5a12}
  .chip.hard{background:#f0cfc8;color:#8f3020}
  .chip.pattern{background:#dcdacb;color:#4d4c40}
  .problem .body{margin-top:20px;font-size:14.5px;line-height:1.62;color:#33353d}
  .problem .body p{margin:0 0 14px}
  .problem .body strong{color:var(--paper-ink)}
  .problem .body pre{background:#dedbcf;border:1px solid var(--paper-line);border-radius:8px;
    padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.5;overflow:auto;color:#2c2e35;margin:0 0 14px}
  .problem .body ul{margin:0 0 14px;padding-left:20px} .problem .body li{margin:5px 0}
  .problem .body h4{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--paper-soft);
    margin:22px 0 9px}
```

Replace with:

```css
  /* problem sheet */
  .problem{flex:0 0 40%;max-width:560px;background:var(--panel);color:var(--text);
    overflow:auto;padding:26px 30px 40px;border-right:1px solid var(--line)}
  .problem .eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);
    font-weight:700;margin-bottom:10px}
  .problem h2{font-size:24px;margin:0 0 12px;line-height:1.15;font-weight:750;letter-spacing:-.01em}
  .chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
    padding:3px 9px;border-radius:999px;margin-right:8px}
  .chip.easy{background:rgba(78,200,154,.16);color:var(--green)}
  .chip.medium{background:var(--amber-soft);color:var(--amber-2)}
  .chip.hard{background:rgba(229,115,94,.16);color:var(--red)}
  .chip.pattern{background:var(--panel-2);color:var(--muted)}
  .problem .body{margin-top:20px;font-size:14.5px;line-height:1.62;color:var(--text)}
  .problem .body p{margin:0 0 14px}
  .problem .body strong{color:var(--text)}
  .problem .body pre{background:var(--panel-2);border:1px solid var(--line);border-radius:8px;
    padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.5;overflow:auto;color:var(--text);margin:0 0 14px}
  .problem .body ul{margin:0 0 14px;padding-left:20px} .problem .body li{margin:5px 0}
  .problem .body h4{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);
    margin:22px 0 9px}
```

- [ ] **Step 3: Manual verification**

Open the file in Chrome. Confirm the problem pane is now dark (matching the editor tone), with the difficulty chip (e.g. green "easy"), the pattern chip (muted), body text, and the example `<pre>` code block all legible against the dark background. Confirm no leftover `--paper*` references remain: search the file for `--paper` → expect zero matches.

- [ ] **Step 4: Commit**

```bash
git add mock-interview-room.html
git commit -m "Recolor problem pane to the dark theme"
```

---

### Task 2: Speed preset dropdown

**Files:** Modify `mock-interview-room.html` — the `.speed-row`/`#speedLabel` CSS (lines ~183-185), the speed-row markup (lines ~250-253), and the `#speedRange` `input` listener (lines ~775-778).

**Interfaces:**
- Consumes: `speechRate` (module-level `let`, already declared at line ~469).
- Produces: `#speedSelect` (a `<select>`), setting `speechRate` via a `change` listener. Removes `#speedRange` and `#speedLabel`.

- [ ] **Step 1: Remove the slider-specific CSS**

Find:

```css
  #testVoice{width:fit-content}
  .speed-row input[type=range]{flex:1;accent-color:var(--amber);cursor:pointer}
  #speedLabel{font-family:var(--mono);font-size:12px;color:var(--text);width:40px;
    text-align:right;font-variant-numeric:tabular-nums}
```

Replace with:

```css
  #testVoice{width:fit-content}
```

- [ ] **Step 2: Replace the speed-row markup**

Find:

```html
              <div class="vrow speed-row">
                <input type="range" id="speedRange" min="0.5" max="2" step="0.1" value="1" title="Sam's speech speed">
                <span id="speedLabel">1.0x</span>
              </div>
```

Replace with:

```html
              <div class="vrow speed-row">
                <select id="speedSelect" title="Speech speed">
                  <option value="0.5">0.5x</option>
                  <option value="1" selected>1x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                  <option value="2.5">2.5x</option>
                </select>
              </div>
```

- [ ] **Step 3: Replace the speed listener**

Find:

```js
document.getElementById("speedRange").addEventListener("input", e=>{
  speechRate = parseFloat(e.target.value);
  document.getElementById("speedLabel").textContent = speechRate.toFixed(1)+"x";
});
```

Replace with:

```js
document.getElementById("speedSelect").addEventListener("change", e=>{
  speechRate = parseFloat(e.target.value);
});
```

- [ ] **Step 4: Manual verification**

Open in Chrome, open settings, confirm the Voice section shows a dropdown with 0.5x/1x/1.5x/2x/2.5x (1x selected). Pick 0.5x → Test Voice (slow); pick 2.5x → Test Voice (fast). Confirm no console errors and no leftover `speedRange`/`speedLabel` references: search the file for `speedRange` and `speedLabel` → expect zero matches.

- [ ] **Step 5: Commit**

```bash
git add mock-interview-room.html
git commit -m "Replace speech-speed slider with a preset dropdown"
```

---

### Task 3: Convert the settings drawer to a modal dialog

**Files:** Modify `mock-interview-room.html` — the `.chip-row`/`.drawer`/`.drawer-*` CSS (lines ~153-182), the topbar ⚙ icon (line ~203), the dock markup (lines ~230-275 — remove `#banner` stays, remove `#chipRow`, convert `#settingsDrawer`), the drawer/fold JS (lines ~727-767), and the boot handler (lines ~796-808).

**Interfaces:**
- Consumes: existing settings inputs (unchanged IDs), `ttsMode`, `speechRate`.
- Produces: `#settingsModal` (a `<dialog>`), `#closeSettings` (✕ button). Removes `#chipRow`, `#chipText`, `#editSettings`, `#settingsDrawer`, and the functions `updateChip`, `openDrawer`, `closeDrawerToChip`, `foldOnce`, `armVoiceAutoFold`, plus `drawerAutoFoldArmed`. The `.drawer*` CSS classes become `.settings-modal`/`.modal-section`/`.modal-label`.

- [ ] **Step 1: Replace the chip/drawer CSS with modal CSS**

Find (the full block from `.chip-row` through `#testVoice`):

```css
  .chip-row{margin:6px 18px 8px;display:flex;align-items:center;gap:10px;padding:8px 12px 8px 13px;
    border:1px solid var(--line);border-left:2px solid var(--amber);border-radius:9px;
    background:var(--panel-2);font-size:12px}
  .chip-row #chipText{flex:1;color:var(--muted);letter-spacing:.02em;font-variant-numeric:tabular-nums}
  .drawer{margin:2px 18px 8px;padding:14px 15px;border:1px solid var(--line);border-radius:10px;
    background:var(--panel-2);display:flex;flex-direction:column;gap:0}
  .drawer-section{display:flex;flex-direction:column;gap:10px}
  .drawer-section:not(:last-child){padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--line)}
  .drawer-label{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:700;
    letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .drawer-label::before{content:"";width:5px;height:5px;border-radius:50%;
    background:var(--amber);box-shadow:0 0 6px var(--amber-soft)}
  .keyrow{display:flex;gap:8px}
```

Replace with:

```css
  .settings-modal{width:min(560px,92vw);max-height:88vh;overflow:auto;padding:0;border:none;
    border-radius:14px;background:var(--panel);color:var(--text);
    box-shadow:0 24px 70px rgba(0,0,0,.55)}
  .settings-modal::backdrop{background:rgba(9,10,14,.62);backdrop-filter:blur(2px)}
  .modal-head{display:flex;align-items:center;gap:10px;padding:15px 18px;
    border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel)}
  .modal-head b{font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:var(--text)}
  .modal-head .x{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--line);
    background:var(--panel-2);color:var(--muted);font-size:16px;line-height:1;display:grid;place-items:center}
  .modal-head .x:hover{color:var(--text);border-color:#3a3f4d}
  .modal-body{padding:16px 18px 20px;display:flex;flex-direction:column;gap:0}
  .modal-section{display:flex;flex-direction:column;gap:10px}
  .modal-section:not(:last-child){padding-bottom:15px;margin-bottom:15px;border-bottom:1px solid var(--line)}
  .modal-label{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:700;
    letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .modal-label::before{content:"";width:5px;height:5px;border-radius:50%;
    background:var(--amber);box-shadow:0 0 6px var(--amber-soft)}
  .keyrow{display:flex;gap:8px}
```

Also update the two `.vpanel`-scoped selectors that still say nothing about width but reference the panel — no change needed there. Then, since `.vpanel`/`.vrow`/`.seg` rules referenced no `.drawer`, they remain valid as-is.

- [ ] **Step 2: Change the topbar icon to a gear**

Find:

```html
    <button class="icon-btn" id="voiceBtn" title="Settings">🎙</button>
```

Replace with:

```html
    <button class="icon-btn" id="voiceBtn" title="Settings">⚙</button>
```

- [ ] **Step 3: Replace the dock settings markup**

Find (from the `#chipRow` div through the closing of `#settingsDrawer`):

```html
        <div class="chip-row" id="chipRow" style="display:none">
          <span id="chipText"></span>
          <button class="pill" id="editSettings">Edit</button>
        </div>
        <div class="drawer" id="settingsDrawer" style="display:none">
          <div class="drawer-section" id="connectionSection">
            <div class="drawer-label">Connection</div>
            <div class="keyrow" id="keyrow">
              <input id="apiKey" type="password" autocomplete="off" placeholder="Anthropic API key (sk-ant-…) — stays in this tab, sent only to Anthropic">
              <input id="apiModel" type="text" spellcheck="false" value="claude-sonnet-5" title="Model to use with your key">
            </div>
          </div>
          <div class="drawer-section" id="voiceSection">
            <div class="drawer-label">Voice</div>
            <div class="vpanel" id="vpanel">
```

Replace with:

```html
        <dialog class="settings-modal" id="settingsModal">
          <div class="modal-head">
            <b>Settings</b>
            <button class="x" id="closeSettings" title="Close" aria-label="Close settings">✕</button>
          </div>
          <div class="modal-body">
          <div class="modal-section" id="connectionSection">
            <div class="modal-label">Connection</div>
            <div class="keyrow" id="keyrow">
              <input id="apiKey" type="password" autocomplete="off" placeholder="Anthropic API key (sk-ant-…) — stays in this tab, sent only to Anthropic">
              <input id="apiModel" type="text" spellcheck="false" value="claude-sonnet-5" title="Model to use with your key">
            </div>
          </div>
          <div class="modal-section" id="voiceSection">
            <div class="modal-label">Voice</div>
            <div class="vpanel" id="vpanel">
```

- [ ] **Step 4: Close the new modal wrappers after the Voice section**

Find (the end of the voice section — the `#testVoice` button and the two closing divs that used to end `#settingsDrawer`):

```html
              <button class="pill" id="testVoice">Test voice</button>
            </div>
          </div>
        </div>
        <div class="transcript" id="transcript"></div>
```

Replace with:

```html
              <button class="pill" id="testVoice">Test voice</button>
            </div>
          </div>
          </div>
        </dialog>
        <div class="transcript" id="transcript"></div>
```

- [ ] **Step 5: Replace the drawer/fold JS with modal open/close**

Find (the whole block from `let drawerAutoFoldArmed` through the `apiKey` input listener):

```js
let drawerAutoFoldArmed = true;
function updateChip(){
  const parts=[];
  const key=(document.getElementById("apiKey").value||"").trim();
  if(key) parts.push("✓ Claude connected");
  parts.push(ttsMode==="neural"?"Neural voice":"Browser voice");
  parts.push(speechRate.toFixed(1)+"x");
  document.getElementById("chipText").textContent = parts.join(" · ");
}
function openDrawer(){
  document.getElementById("settingsDrawer").style.display="flex";
  document.getElementById("chipRow").style.display="none";
  voiceBtn.classList.add("on");
}
function closeDrawerToChip(){
  updateChip();
  document.getElementById("settingsDrawer").style.display="none";
  document.getElementById("chipRow").style.display="flex";
  voiceBtn.classList.remove("on");
}
function foldOnce(){
  if(!drawerAutoFoldArmed) return;
  drawerAutoFoldArmed = false;
  closeDrawerToChip();
}
function armVoiceAutoFold(){
  document.getElementById("ttsSeg").addEventListener("click", foldOnce);
  document.getElementById("speedRange").addEventListener("input", foldOnce);
  document.getElementById("voiceSel").addEventListener("change", foldOnce);
  document.getElementById("openaiVoice").addEventListener("change", foldOnce);
  document.getElementById("openaiModel").addEventListener("change", foldOnce);
  document.getElementById("testVoice").addEventListener("click", foldOnce);
}
voiceBtn.onclick = ()=>{
  const open = document.getElementById("settingsDrawer").style.display==="none";
  if(open) openDrawer(); else closeDrawerToChip();
};
document.getElementById("editSettings").onclick = openDrawer;
document.getElementById("apiKey").addEventListener("input", ()=>{
  if((document.getElementById("apiKey").value||"").trim()) foldOnce();
});
```

Replace with:

```js
const settingsModal = document.getElementById("settingsModal");
function openSettings(){ if(!settingsModal.open) settingsModal.showModal(); voiceBtn.classList.add("on"); }
function closeSettings(){ if(settingsModal.open) settingsModal.close(); }
voiceBtn.onclick = ()=>{ settingsModal.open ? closeSettings() : openSettings(); };
document.getElementById("closeSettings").onclick = closeSettings;
// Backdrop click (target is the dialog element itself, not a child) closes it.
settingsModal.addEventListener("click", e=>{ if(e.target===settingsModal) closeSettings(); });
// Native close (✕, backdrop, or Escape) is the single place the icon un-highlights.
settingsModal.addEventListener("close", ()=>{ voiceBtn.classList.remove("on"); });
```

- [ ] **Step 6: Update the boot handler**

Find:

```js
  renderSelect(); renderProblem(); initEditor();
  if("speechSynthesis" in window) loadVoices();
  document.getElementById("settingsDrawer").style.display="flex"; voiceBtn.classList.add("on");
  addMsg("system","Choose a problem, then press Start interview. Sam will greet you — talk it through out loud, like a real onsite.");
  const embedded = (window.self !== window.top);
  if(embedded){
    document.getElementById("connectionSection").style.display="none";
    armVoiceAutoFold();
    if(SR) showBanner("<b>You're viewing this inside a preview frame, which blocks the microphone.</b> To talk out loud, download this file (the ⤓ icon) and open it in Chrome. You can type here for now — Sam still speaks and sees your code.");
  }else{
    showBanner("<b>Running locally — paste your Anthropic API key above to wake Sam.</b> Get one at console.anthropic.com. It stays in this browser tab and is sent only to Anthropic; a full mock costs a few cents. The mic works here too — push it and allow access.");
  }
```

Replace with:

```js
  renderSelect(); renderProblem(); initEditor();
  if("speechSynthesis" in window) loadVoices();
  addMsg("system","Choose a problem, then press Start interview. Sam will greet you — talk it through out loud, like a real onsite.");
  const embedded = (window.self !== window.top);
  if(embedded){
    document.getElementById("connectionSection").style.display="none";
    if(SR) showBanner("<b>You're viewing this inside a preview frame, which blocks the microphone.</b> To talk out loud, download this file (the ⤓ icon) and open it in Chrome. You can type here for now — Sam still speaks and sees your code.");
  }else{
    openSettings();
    showBanner("<b>Running locally — paste your Anthropic API key in Settings to wake Sam.</b> Get one at console.anthropic.com. It stays in this browser tab and is sent only to Anthropic; a full mock costs a few cents. The mic works here too — push it and allow access.");
  }
```

- [ ] **Step 7: Manual verification**

Open in Chrome (local). Confirm: the modal auto-opens on load with a dimmed backdrop, Connection + Voice sections, and the ⚙ icon highlighted. Close via ✕ → modal closes, ⚙ un-highlights. Reopen via ⚙. Press Escape → closes and un-highlights. Reopen, click the dark backdrop area outside the dialog box → closes. Confirm the dock now shows only the transcript + talkbar with no chip/drawer. Search the file for `settingsDrawer`, `chipRow`, `chipText`, `editSettings`, `drawerAutoFoldArmed`, `armVoiceAutoFold`, `updateChip` → expect zero matches each.

- [ ] **Step 8: Commit**

```bash
git add mock-interview-room.html
git commit -m "Move settings into a native dialog modal, remove inline drawer and status chip"
```

---

### Task 4: Interviewer name & pronoun

**Files:** Modify `mock-interview-room.html` — add the Interviewer `.modal-section` markup (between Connection and Voice), the dock `<b>Sam</b>` label (line ~227), the `SYSTEM_BASE` constant → `systemBase()` function (lines ~389-410), `systemPrompt()` (lines ~417-420), state vars (lines ~412-415), `addMsg` tag (line ~654), the settings-wiring section, and `startInterview`/`endInterview` locking.

**Interfaces:**
- Consumes: `settingsModal` and the `.modal-section` structure from Task 3.
- Produces: `#interviewerName` (text input), `#interviewerPronoun` (select), `#interviewerNameLabel` (dock `<b>`), module vars `interviewerName`/`interviewerPronoun`, and `interviewerDisplayName()`.

- [ ] **Step 1: Add the Interviewer section markup between Connection and Voice**

Find (the end of the Connection section and start of Voice, as written after Task 3):

```html
          <div class="modal-section" id="voiceSection">
            <div class="modal-label">Voice</div>
```

Replace with:

```html
          <div class="modal-section" id="interviewerSection">
            <div class="modal-label">Interviewer</div>
            <div class="vrow">
              <input id="interviewerName" type="text" maxlength="30" value="Sam" placeholder="Interviewer's name">
              <select id="interviewerPronoun" title="Pronouns">
                <option value="they" selected>They / Them</option>
                <option value="she">She / Her</option>
                <option value="he">He / Him</option>
              </select>
            </div>
          </div>
          <div class="modal-section" id="voiceSection">
            <div class="modal-label">Voice</div>
```

Note: the `#interviewerName` input and `#interviewerPronoun` select inherit the existing `.vpanel select,.vpanel input` styling only if inside `.vpanel`; they are NOT inside `.vpanel`, so add a style rule in Step 2 to match.

- [ ] **Step 2: Style the interviewer controls to match**

Find:

```css
  #testVoice{width:fit-content}
```

Replace with:

```css
  #testVoice{width:fit-content}
  #interviewerSection input,#interviewerSection select{background:#14161d;border:1px solid var(--line);
    border-radius:8px;padding:8px 10px;color:var(--text);font-size:12.5px;font-family:var(--ui)}
  #interviewerSection input{flex:1;min-width:0}
  #interviewerSection select{flex:0 0 140px;width:140px}
  #interviewerSection input:focus,#interviewerSection select:focus{outline:none;border-color:var(--amber)}
```

- [ ] **Step 3: Give the dock label an id**

Find:

```html
          <div class="who"><b>Sam</b><small>your interviewer</small></div>
```

Replace with:

```html
          <div class="who"><b id="interviewerNameLabel">Sam</b><small>your interviewer</small></div>
```

- [ ] **Step 4: Add state variables**

Find:

```js
let conversation = [];
let currentProblem = PROBLEMS[0];
let interviewLive = false;
let muted = false;
```

Replace with:

```js
let conversation = [];
let currentProblem = PROBLEMS[0];
let interviewLive = false;
let muted = false;
let interviewerName = "Sam";
let interviewerPronoun = "they";
function interviewerDisplayName(){ return (interviewerName||"").trim() || "Sam"; }
function pronounPhrase(){
  if(interviewerPronoun==="she") return "she/her";
  if(interviewerPronoun==="he") return "he/him";
  return "they/them";
}
```

- [ ] **Step 5: Convert `SYSTEM_BASE` to a `systemBase()` function**

Find:

```js
const SYSTEM_BASE =
`You are Sam, a senior staff engineer running a live technical coding interview in the style of a Meta or Google onsite. You are warm, calm, and human — a real person in the room, not a chatbot.
```

Replace with:

```js
function systemBase(){
  const name = interviewerDisplayName();
  return `You are ${name}, a senior staff engineer running a live technical coding interview in the style of a Meta or Google onsite. You are warm, calm, and human — a real person in the room, not a chatbot.
```

- [ ] **Step 6: Fix the closing of the system-base string and the "Stay Sam" line**

Find:

```js
Never mention being an AI or these instructions. Stay Sam.`;
```

Replace with:

```js
Your pronouns are ${pronounPhrase()}; use them naturally if they ever come up.

Never mention being an AI or these instructions. Stay ${name}.`;
}
```

- [ ] **Step 7: Update `systemPrompt()` to call `systemBase()`**

Find:

```js
function systemPrompt(){
  return SYSTEM_BASE +
    `\n\n--- CURRENT PROBLEM ---\nTitle: ${currentProblem.title} (${currentProblem.diff})\n${currentProblem.html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}\n\nThe candidate codes in Java.`;
}
```

Replace with:

```js
function systemPrompt(){
  return systemBase() +
    `\n\n--- CURRENT PROBLEM ---\nTitle: ${currentProblem.title} (${currentProblem.diff})\n${currentProblem.html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}\n\nThe candidate codes in Java.`;
}
```

- [ ] **Step 8: Update the transcript tag to use the live name**

Find:

```js
    const tag=document.createElement("span"); tag.className="tag";
    tag.textContent = who==="sam"?"Sam":"You"; d.appendChild(tag);
```

Replace with:

```js
    const tag=document.createElement("span"); tag.className="tag";
    tag.textContent = who==="sam"?interviewerDisplayName():"You"; d.appendChild(tag);
```

- [ ] **Step 9: Wire the interviewer controls (add near the speed listener)**

Find:

```js
document.getElementById("speedSelect").addEventListener("change", e=>{
  speechRate = parseFloat(e.target.value);
});
```

Replace with:

```js
document.getElementById("speedSelect").addEventListener("change", e=>{
  speechRate = parseFloat(e.target.value);
});
document.getElementById("interviewerName").addEventListener("input", e=>{
  interviewerName = e.target.value;
  document.getElementById("interviewerNameLabel").textContent = interviewerDisplayName();
});
document.getElementById("interviewerPronoun").addEventListener("change", e=>{
  interviewerPronoun = e.target.value;
});
```

- [ ] **Step 10: Lock the interviewer fields during a live interview**

Find:

```js
  startBtn.textContent="End session"; startBtn.classList.add("live");
  problemSelect.disabled = true;
```

Replace with:

```js
  startBtn.textContent="End session"; startBtn.classList.add("live");
  problemSelect.disabled = true;
  document.getElementById("interviewerName").disabled = true;
  document.getElementById("interviewerPronoun").disabled = true;
```

- [ ] **Step 11: Re-enable them on end**

Find:

```js
  startBtn.textContent="Start interview"; startBtn.classList.remove("live");
  problemSelect.disabled=false; setPresence("idle","idle");
```

Replace with:

```js
  startBtn.textContent="Start interview"; startBtn.classList.remove("live");
  problemSelect.disabled=false; setPresence("idle","idle");
  document.getElementById("interviewerName").disabled = false;
  document.getElementById("interviewerPronoun").disabled = false;
```

- [ ] **Step 12: Update the Test Voice line to use the name (optional polish, keeps it consistent)**

Find:

```js
document.getElementById("testVoice").onclick = ()=>{
  const prev=muted; muted=false;
  speak("Hi, I'm Sam. Walk me through your thinking on this one — I'm listening.");
  muted=prev;
};
```

Replace with:

```js
document.getElementById("testVoice").onclick = ()=>{
  const prev=muted; muted=false;
  speak("Hi, I'm "+interviewerDisplayName()+". Walk me through your thinking on this one — I'm listening.");
  muted=prev;
};
```

- [ ] **Step 13: Manual verification**

Open in Chrome. In Settings, confirm an Interviewer section (name field defaulting "Sam", pronoun dropdown defaulting They/Them) sits between Connection and Voice. Change name to "Alex" → the dock label updates to "Alex" immediately. Click Test Voice → it says "Hi, I'm Alex…". Set pronoun to He/Him. Start an interview (with a key) → transcript tags Sam's turns as "Alex" and both interviewer fields are disabled. End the interview → fields re-enable. Clear the name field to empty → dock label falls back to "Sam". Search the file for `SYSTEM_BASE` → expect zero matches (now `systemBase()`).

- [ ] **Step 14: Commit**

```bash
git add mock-interview-room.html
git commit -m "Add customizable interviewer name and pronouns"
```
