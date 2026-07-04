# Settings Drawer, Speech Speed & Hands-Free Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Anthropic/OpenAI setup UI in `mock-interview-room.html` into one collapsible settings drawer that auto-folds once configured, add a speech-speed slider that controls both browser and OpenAI TTS playback rate, and make voice input auto-send after a detected pause (hands-free), re-arming after Sam replies.

**Architecture:** Everything lives in the single static file `mock-interview-room.html` (no build step, no server, no test framework). Each task is a self-contained edit to that file: markup/CSS restructuring first, then the speed-control variable + wiring (needed by the chip text), then the fold/collapse behavior that reads it, then hands-free pause detection, then a visual-polish pass. This ordering exists so no task references a variable (`speechRate`) that a later task hasn't defined yet — every commit leaves the app in a working, loadable state.

**Tech Stack:** Vanilla HTML/CSS/JS, CodeMirror 5 (CDN, unchanged), Web Speech API (`SpeechRecognition`, `speechSynthesis`), OpenAI `/v1/audio/speech`, Anthropic `/v1/messages`.

## Global Constraints

- Single file only: all changes go in `mock-interview-room.html`. Do not introduce a build step, package.json, or new external scripts.
- No automated test framework exists for this file and none should be added — verification per task is **manual, in desktop Chrome**, per the spec's Testing Approach section. Each task's "test" step below is a concrete manual checklist, not an automated test.
- Preserve all existing element IDs consumed by JS that aren't explicitly renamed in this plan (`apiKey`, `apiModel`, `openaiKey`, `openaiVoice`, `openaiModel`, `voiceSel`, `ttsSeg`, `browserRow`, `neuralRow`, `testVoice`) — `ask()`, `speak()`, `speakNeural()`, `fillVoiceSelect()` all read these by ID and must keep working unmodified except where a task explicitly says to touch them.
- This repo is not yet a git repository. Task 0 initializes it. Every subsequent task ends with a commit.
- Keep behavior identical to today except for the specific changes each task describes — this is a UI/UX refinement, not a rewrite of the interview logic, editor, or problem set.

---

### Task 0: Initialize git

**Files:**
- None modified — repo setup only.

**Interfaces:** N/A

- [ ] **Step 1: Initialize the repository and commit the current state**

```bash
cd /Users/developer/workspace/interview
git init
git add mock-interview-room.html docs
git commit -m "Initial commit: mock interview room before settings/voice redesign"
```

- [ ] **Step 2: Verify**

Run: `git log --oneline` — expect one commit, and `git status` shows a clean working tree.

---

### Task 1: Unified settings drawer — markup, CSS, basic open/close

**Files:**
- Modify: `mock-interview-room.html` (CSS block currently defining `.keyrow`/`.vpanel`/`.seg`/`.vrow`/`#testVoice`; the `#banner`/`#keyrow`/`#vpanel` HTML block inside `.dock`; the `voiceBtn.onclick` handler; the boot `window.addEventListener("load", ...)` handler)

**Interfaces:**
- Produces: `#settingsDrawer` (container, `display:none` by default), `#connectionSection`, `#voiceSection`, `#chipRow` (container, `display:none` by default), `#chipText`, `#editSettings` (button, wiring added in Task 3 — present but inert in this task), `#speedRange` / `#speedLabel` (markup only — wiring added in Task 2). All pre-existing IDs (`apiKey`, `apiModel`, `ttsSeg`, `browserRow`, `voiceSel`, `neuralRow`, `openaiKey`, `openaiVoice`, `openaiModel`, `testVoice`) are preserved unchanged, just re-nested.
- Consumes: nothing new from other tasks.

- [ ] **Step 1: Replace the CSS block**

Find this exact block (originally around lines 153–171):

```css
  .keyrow{display:flex;gap:8px;margin:2px 18px 8px}
  .keyrow input{background:var(--panel-2);border:1px solid var(--line);border-radius:9px;
    padding:9px 11px;color:var(--text);font-size:12.5px;font-family:var(--mono)}
  .keyrow input#apiKey{flex:1;min-width:0}
  .keyrow input#apiModel{width:172px;flex:0 0 172px}
  .keyrow input:focus{outline:none;border-color:var(--amber)}
  .vpanel{margin:2px 18px 8px;padding:11px 12px;border:1px solid var(--line);border-radius:10px;
    background:var(--panel-2);display:flex;flex-direction:column;gap:9px}
  .seg{display:inline-flex;background:#14161d;border:1px solid var(--line);border-radius:8px;
    overflow:hidden;width:fit-content}
  .seg button{padding:6px 13px;font-size:12px;color:var(--muted)}
  .seg button.on{background:var(--amber);color:#231703;font-weight:650}
  .vrow{display:flex;gap:8px}
  .vpanel select,.vpanel input{background:#14161d;border:1px solid var(--line);border-radius:8px;
    padding:8px 10px;color:var(--text);font-size:12.5px;font-family:var(--ui)}
  .vpanel select{flex:1;min-width:0}
  .vpanel input#openaiKey{flex:1;min-width:0;font-family:var(--mono)}
  .vpanel select#openaiVoice,.vpanel select#openaiModel{flex:0 0 130px;width:130px}
  #testVoice{width:fit-content}
```

Replace it with:

```css
  .chip-row{margin:6px 18px 8px;display:flex;align-items:center;gap:10px;padding:9px 12px;
    border:1px solid var(--line);border-radius:9px;background:var(--panel-2);font-size:12.5px}
  .chip-row #chipText{flex:1;color:var(--text)}
  .drawer{margin:2px 18px 8px;padding:13px 14px;border:1px solid var(--line);border-radius:10px;
    background:var(--panel-2);display:flex;flex-direction:column;gap:14px}
  .drawer-section{display:flex;flex-direction:column;gap:9px}
  .drawer-label{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .keyrow{display:flex;gap:8px}
  .keyrow input{background:#14161d;border:1px solid var(--line);border-radius:9px;
    padding:9px 11px;color:var(--text);font-size:12.5px;font-family:var(--mono)}
  .keyrow input#apiKey{flex:1;min-width:0}
  .keyrow input#apiModel{width:172px;flex:0 0 172px}
  .keyrow input:focus{outline:none;border-color:var(--amber)}
  .vpanel{display:flex;flex-direction:column;gap:9px}
  .seg{display:inline-flex;background:#14161d;border:1px solid var(--line);border-radius:8px;
    overflow:hidden;width:fit-content}
  .seg button{padding:6px 13px;font-size:12px;color:var(--muted)}
  .seg button.on{background:var(--amber);color:#231703;font-weight:650}
  .vrow{display:flex;gap:8px;align-items:center}
  .vpanel select,.vpanel input{background:#14161d;border:1px solid var(--line);border-radius:8px;
    padding:8px 10px;color:var(--text);font-size:12.5px;font-family:var(--ui)}
  .vpanel select{flex:1;min-width:0}
  .vpanel input#openaiKey{flex:1;min-width:0;font-family:var(--mono)}
  .vpanel select#openaiVoice,.vpanel select#openaiModel{flex:0 0 130px;width:130px}
  #testVoice{width:fit-content}
  .speed-row input[type=range]{flex:1;accent-color:var(--amber)}
  #speedLabel{font-size:12px;color:var(--text);width:38px;text-align:right;font-variant-numeric:tabular-nums}
```

- [ ] **Step 2: Replace the HTML block**

Find this exact block inside `.dock`:

```html
        <div class="banner" id="banner" style="display:none"></div>
        <div class="keyrow" id="keyrow" style="display:none">
          <input id="apiKey" type="password" autocomplete="off" placeholder="Anthropic API key (sk-ant-…) — stays in this tab, sent only to Anthropic">
          <input id="apiModel" type="text" spellcheck="false" value="claude-sonnet-5" title="Model to use with your key">
        </div>
        <div class="vpanel" id="vpanel" style="display:none">
          <div class="seg" id="ttsSeg">
            <button data-mode="browser" class="on">Browser voice</button>
            <button data-mode="neural">Neural · OpenAI</button>
          </div>
          <div class="vrow" id="browserRow">
            <select id="voiceSel" title="Choose a browser voice"></select>
          </div>
          <div class="vrow" id="neuralRow" style="display:none">
            <input id="openaiKey" type="password" autocomplete="off" placeholder="OpenAI API key (sk-…) — for the neural voice">
            <select id="openaiVoice" title="Voice">
              <option value="alloy">Alloy</option><option value="ash">Ash</option>
              <option value="ballad">Ballad</option><option value="coral">Coral</option>
              <option value="echo">Echo</option><option value="fable">Fable</option>
              <option value="onyx" selected>Onyx</option><option value="nova">Nova</option>
              <option value="sage">Sage</option><option value="shimmer">Shimmer</option>
            </select>
            <select id="openaiModel" title="Model">
              <option value="gpt-4o-mini-tts" selected>4o-mini-tts</option>
              <option value="tts-1-hd">tts-1-hd</option>
              <option value="tts-1">tts-1</option>
            </select>
          </div>
          <button class="pill" id="testVoice">Test voice</button>
        </div>
```

Replace it with:

```html
        <div class="banner" id="banner" style="display:none"></div>
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
              <div class="seg" id="ttsSeg">
                <button data-mode="browser" class="on">Browser voice</button>
                <button data-mode="neural">Neural · OpenAI</button>
              </div>
              <div class="vrow speed-row">
                <input type="range" id="speedRange" min="0.5" max="2" step="0.1" value="1" title="Sam's speech speed">
                <span id="speedLabel">1.0x</span>
              </div>
              <div class="vrow" id="browserRow">
                <select id="voiceSel" title="Choose a browser voice"></select>
              </div>
              <div class="vrow" id="neuralRow" style="display:none">
                <input id="openaiKey" type="password" autocomplete="off" placeholder="OpenAI API key (sk-…) — for the neural voice">
                <select id="openaiVoice" title="Voice">
                  <option value="alloy">Alloy</option><option value="ash">Ash</option>
                  <option value="ballad">Ballad</option><option value="coral">Coral</option>
                  <option value="echo">Echo</option><option value="fable">Fable</option>
                  <option value="onyx" selected>Onyx</option><option value="nova">Nova</option>
                  <option value="sage">Sage</option><option value="shimmer">Shimmer</option>
                </select>
                <select id="openaiModel" title="Model">
                  <option value="gpt-4o-mini-tts" selected>4o-mini-tts</option>
                  <option value="tts-1-hd">tts-1-hd</option>
                  <option value="tts-1">tts-1</option>
                </select>
              </div>
              <button class="pill" id="testVoice">Test voice</button>
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Replace the `voiceBtn.onclick` handler**

Find:

```js
voiceBtn.onclick = ()=>{
  const p=document.getElementById("vpanel");
  const open = p.style.display==="none";
  p.style.display = open?"flex":"none";
  voiceBtn.classList.toggle("on", open);
};
```

Replace with:

```js
voiceBtn.onclick = ()=>{
  const p=document.getElementById("settingsDrawer");
  const open = p.style.display==="none";
  p.style.display = open?"flex":"none";
  voiceBtn.classList.toggle("on", open);
};
```

- [ ] **Step 4: Update the boot handler**

Find:

```js
window.addEventListener("load", ()=>{
  renderSelect(); renderProblem(); initEditor();
  if("speechSynthesis" in window) loadVoices();
  document.getElementById("vpanel").style.display="flex"; voiceBtn.classList.add("on");
  addMsg("system","Choose a problem, then press Start interview. Sam will greet you — talk it through out loud, like a real onsite.");
  const embedded = (window.self !== window.top);
  if(embedded){
    if(SR) showBanner("<b>You're viewing this inside a preview frame, which blocks the microphone.</b> To talk out loud, download this file (the ⤓ icon) and open it in Chrome. You can type here for now — Sam still speaks and sees your code.");
  }else{
    document.getElementById("keyrow").style.display="flex";
    showBanner("<b>Running locally — paste your Anthropic API key above to wake Sam.</b> Get one at console.anthropic.com. It stays in this browser tab and is sent only to Anthropic; a full mock costs a few cents. The mic works here too — push it and allow access.");
  }
  if(!("speechSynthesis" in window)) setNote("Your browser can't do voice output — Sam will still type. Chrome works best.", true);
  else if(!sttOK) setNote("Voice input isn't supported here — you can type responses. Sam speaks aloud. (Chrome works best.)", true);
});
```

Replace with:

```js
window.addEventListener("load", ()=>{
  renderSelect(); renderProblem(); initEditor();
  if("speechSynthesis" in window) loadVoices();
  document.getElementById("settingsDrawer").style.display="flex"; voiceBtn.classList.add("on");
  addMsg("system","Choose a problem, then press Start interview. Sam will greet you — talk it through out loud, like a real onsite.");
  const embedded = (window.self !== window.top);
  if(embedded){
    document.getElementById("connectionSection").style.display="none";
    if(SR) showBanner("<b>You're viewing this inside a preview frame, which blocks the microphone.</b> To talk out loud, download this file (the ⤓ icon) and open it in Chrome. You can type here for now — Sam still speaks and sees your code.");
  }else{
    showBanner("<b>Running locally — paste your Anthropic API key above to wake Sam.</b> Get one at console.anthropic.com. It stays in this browser tab and is sent only to Anthropic; a full mock costs a few cents. The mic works here too — push it and allow access.");
  }
  if(!("speechSynthesis" in window)) setNote("Your browser can't do voice output — Sam will still type. Chrome works best.", true);
  else if(!sttOK) setNote("Voice input isn't supported here — you can type responses. Sam speaks aloud. (Chrome works best.)", true);
});
```

- [ ] **Step 5: Manual verification**

Open `mock-interview-room.html` directly in Chrome (`open mock-interview-room.html` or drag into a tab — not inside an iframe preview, so it's the "local" branch). Confirm:
- The drawer is visible on load, containing both a "Connection" section (Anthropic key + model) and a "Voice" section (mode toggle, new speed slider showing "1.0x", voice select, Test voice button) inside one bordered card.
- Clicking the 🎙 icon in the top bar closes the drawer; clicking it again reopens it.
- Typing in the Anthropic key field and clicking Test voice still work exactly as before (no functional regression, since this task only restructures markup/CSS).

- [ ] **Step 6: Commit**

```bash
git add mock-interview-room.html
git commit -m "Merge Anthropic/OpenAI setup into one unified settings drawer"
```

---

### Task 2: Speech speed control

**Files:**
- Modify: `mock-interview-room.html` (TTS state variables, `speakBrowser`, `speakNeural`, and the wiring section near `#ttsSeg`)

**Interfaces:**
- Produces: `let speechRate` (module-level, default `1.0`, range 0.5–2.0), updated live from `#speedRange`'s `input` event.
- Consumes: `#speedRange` / `#speedLabel` markup from Task 1.

- [ ] **Step 1: Declare the state variable**

Find:

```js
let preferredVoice = null;
let ttsMode = "browser";       // 'browser' | 'neural'
let ttsPlaying = false;        // true while neural audio is playing
let neuralAudio = null;
```

Replace with:

```js
let preferredVoice = null;
let ttsMode = "browser";       // 'browser' | 'neural'
let ttsPlaying = false;        // true while neural audio is playing
let neuralAudio = null;
let speechRate = 1.0;          // 0.5 - 2.0, controls both browser and neural TTS pace
```

- [ ] **Step 2: Use it in `speakBrowser`**

Find:

```js
  const u = new SpeechSynthesisUtterance(stripForSpeech(text));
  if(preferredVoice) u.voice = preferredVoice;
  u.rate = 1.02; u.pitch = 1.0;
```

Replace with:

```js
  const u = new SpeechSynthesisUtterance(stripForSpeech(text));
  if(preferredVoice) u.voice = preferredVoice;
  u.rate = speechRate; u.pitch = 1.0;
```

- [ ] **Step 3: Use it in `speakNeural`**

Find:

```js
    const body = { model, voice, input:stripForSpeech(text), response_format:"mp3" };
    if(model==="gpt-4o-mini-tts") body.instructions = "You are a calm, warm, professional technical interviewer. Speak naturally, at a measured, unhurried pace.";
```

Replace with:

```js
    const body = { model, voice, input:stripForSpeech(text), response_format:"mp3" };
    if(model==="tts-1"||model==="tts-1-hd"){
      body.speed = speechRate;
    }
    if(model==="gpt-4o-mini-tts"){
      let pace = "";
      if(speechRate < 0.85) pace = " Speak at a noticeably slower, more deliberate pace.";
      else if(speechRate > 1.15) pace = " Speak at a noticeably brisker pace.";
      body.instructions = "You are a calm, warm, professional technical interviewer. Speak naturally, at a measured, unhurried pace."+pace;
    }
```

- [ ] **Step 4: Wire the slider**

Find:

```js
document.getElementById("ttsSeg").addEventListener("click", e=>{
  const b=e.target.closest("button[data-mode]"); if(!b) return;
  ttsMode=b.dataset.mode;
  [...document.querySelectorAll("#ttsSeg button")].forEach(x=>x.classList.toggle("on", x===b));
  document.getElementById("browserRow").style.display = ttsMode==="browser"?"flex":"none";
  document.getElementById("neuralRow").style.display  = ttsMode==="neural" ?"flex":"none";
});
document.getElementById("testVoice").onclick = ()=>{
```

Replace with:

```js
document.getElementById("ttsSeg").addEventListener("click", e=>{
  const b=e.target.closest("button[data-mode]"); if(!b) return;
  ttsMode=b.dataset.mode;
  [...document.querySelectorAll("#ttsSeg button")].forEach(x=>x.classList.toggle("on", x===b));
  document.getElementById("browserRow").style.display = ttsMode==="browser"?"flex":"none";
  document.getElementById("neuralRow").style.display  = ttsMode==="neural" ?"flex":"none";
});
document.getElementById("speedRange").addEventListener("input", e=>{
  speechRate = parseFloat(e.target.value);
  document.getElementById("speedLabel").textContent = speechRate.toFixed(1)+"x";
});
document.getElementById("testVoice").onclick = ()=>{
```

- [ ] **Step 5: Manual verification**

In Chrome, open the drawer, drag the speed slider to the far left (label reads "0.5x"), click Test voice with "Browser voice" selected — confirm Sam's test line plays noticeably slower than default. Drag to the far right ("2.0x"), click Test voice again — confirm noticeably faster. Drag back to the middle ("1.0x") and confirm it sounds like the original pace. (If you have an OpenAI key handy, repeat with "Neural · OpenAI" mode selected for `tts-1-hd` — the `speed` param should audibly change pace; this check is optional if no key is available, since it requires a paid API call.)

- [ ] **Step 6: Commit**

```bash
git add mock-interview-room.html
git commit -m "Add user-controllable speech speed for browser and neural TTS"
```

---

### Task 3: Auto-fold the drawer once configured, with a status chip

**Files:**
- Modify: `mock-interview-room.html` (replace the `voiceBtn.onclick` handler from Task 1 with the full fold-aware version; update the boot handler's embedded branch)

**Interfaces:**
- Produces: `openDrawer()`, `closeDrawerToChip()`, `updateChip()`, `foldOnce()`, `armVoiceAutoFold()`, `let drawerAutoFoldArmed`.
- Consumes: `speechRate` (Task 2), `ttsMode` (pre-existing), `#chipRow`/`#chipText`/`#editSettings`/`#connectionSection` (Task 1).

- [ ] **Step 1: Replace the drawer toggle with fold-aware logic**

Find (this is the handler Task 1 installed):

```js
voiceBtn.onclick = ()=>{
  const p=document.getElementById("settingsDrawer");
  const open = p.style.display==="none";
  p.style.display = open?"flex":"none";
  voiceBtn.classList.toggle("on", open);
};
```

Replace with:

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

- [ ] **Step 2: Arm the voice-only fold path when embedded (no Anthropic key field to react to)**

Find:

```js
  if(embedded){
    document.getElementById("connectionSection").style.display="none";
    if(SR) showBanner("<b>You're viewing this inside a preview frame, which blocks the microphone.</b> To talk out loud, download this file (the ⤓ icon) and open it in Chrome. You can type here for now — Sam still speaks and sees your code.");
  }else{
```

Replace with:

```js
  if(embedded){
    document.getElementById("connectionSection").style.display="none";
    armVoiceAutoFold();
    if(SR) showBanner("<b>You're viewing this inside a preview frame, which blocks the microphone.</b> To talk out loud, download this file (the ⤓ icon) and open it in Chrome. You can type here for now — Sam still speaks and sees your code.");
  }else{
```

- [ ] **Step 3: Manual verification**

In Chrome, local (non-embedded) load: type any character into the Anthropic key field — confirm the drawer collapses immediately into a chip reading `✓ Claude connected · Browser voice · 1.0x`. Click **Edit** — confirm the drawer reopens with the key still in the field. Click the 🎙 icon — confirm it also toggles open/closed and stays in sync with Edit/chip state. Change the speed slider or TTS mode after re-opening — confirm the drawer does *not* auto-collapse again (only the very first fold is automatic; afterwards it's manual via Edit/🎙 only).

To check the embedded path: temporarily wrap the file in a minimal `<iframe src="mock-interview-room.html">` test page (or use the existing preview-frame behavior if available) and confirm interacting with any Voice control (e.g. dragging the speed slider) triggers the same auto-collapse, with the chip omitting the "✓ Claude connected" segment since there's no key field in that mode.

- [ ] **Step 4: Commit**

```bash
git add mock-interview-room.html
git commit -m "Auto-fold settings drawer into a status chip once configured"
```

---

### Task 4: Hands-free pause detection

**Files:**
- Modify: `mock-interview-room.html` (STT state, `recog.onresult`, `recog.onerror`, `startListening`, `stopListening`, `onSpeechEnd`, `micBtn.onclick`, `endInterview`)

**Interfaces:**
- Produces: `const PAUSE_MS = 1200`, `let handsFree`, `clearSilenceTimer()`.
- Consumes: `sendSpoken()`, `stopListening()`, `startListening()` (all pre-existing, unchanged signatures).

- [ ] **Step 1: Add hands-free state**

Find:

```js
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false, sttOK = !!SR, heard = "";
```

Replace with:

```js
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false, sttOK = !!SR, heard = "";
const PAUSE_MS = 1200;
let handsFree = false, silenceTimer = null;
function clearSilenceTimer(){ if(silenceTimer){ clearTimeout(silenceTimer); silenceTimer=null; } }
```

- [ ] **Step 2: Reset the silence timer on every recognition result**

Find:

```js
  recog.onresult = e=>{
    let interim="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const r=e.results[i];
      if(r.isFinal) heard += r[0].transcript+" "; else interim += r[0].transcript;
    }
    textInput.value = (heard+interim).trim();
  };
```

Replace with:

```js
  recog.onresult = e=>{
    let interim="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const r=e.results[i];
      if(r.isFinal) heard += r[0].transcript+" "; else interim += r[0].transcript;
    }
    textInput.value = (heard+interim).trim();
    if(handsFree){
      clearSilenceTimer();
      silenceTimer = setTimeout(()=>{
        if(textInput.value.trim()) sendSpoken();
      }, PAUSE_MS);
    }
  };
```

- [ ] **Step 3: Reset hands-free state if the mic gets blocked mid-session**

Find:

```js
  recog.onerror = ev=>{
    if(ev.error==="not-allowed"||ev.error==="service-not-allowed"){
      sttOK=false; micBtn.disabled=true; stopListening();
      showBanner("<b>Mic blocked.</b> This preview frame won't allow the microphone. Download this file and open it in Chrome to talk out loud — for now, type your responses below.", "err");
    }
  };
```

Replace with:

```js
  recog.onerror = ev=>{
    if(ev.error==="not-allowed"||ev.error==="service-not-allowed"){
      sttOK=false; micBtn.disabled=true; handsFree=false; clearSilenceTimer(); stopListening();
      showBanner("<b>Mic blocked.</b> This preview frame won't allow the microphone. Download this file and open it in Chrome to talk out loud — for now, type your responses below.", "err");
    }
  };
```

- [ ] **Step 4: Clear any stale timer when a new listening turn starts**

Find:

```js
  stopAllSpeech();
  heard=""; textInput.value="";
  try{ recog.start(); }catch(_){}
```

Replace with:

```js
  stopAllSpeech();
  heard=""; textInput.value=""; clearSilenceTimer();
  try{ recog.start(); }catch(_){}
```

- [ ] **Step 5: Clear the timer whenever listening stops**

Find:

```js
function stopListening(){
  listening=false; micBtn.classList.remove("rec");
  if(recog){ try{recog.stop();}catch(_){}}
  if(!speaking()) setPresence("idle", interviewLive?"idle":"idle");
}
```

Replace with:

```js
function stopListening(){
  listening=false; micBtn.classList.remove("rec"); clearSilenceTimer();
  if(recog){ try{recog.stop();}catch(_){}}
  if(!speaking()) setPresence("idle", interviewLive?"idle":"idle");
}
```

- [ ] **Step 6: Re-arm listening after Sam finishes speaking, in hands-free mode**

Find:

```js
function onSpeechEnd(){ if(!listening) setPresence("idle", interviewLive?"listening for you":"idle"); }
```

Replace with:

```js
function onSpeechEnd(){
  if(!listening) setPresence("idle", interviewLive?"listening for you":"idle");
  if(interviewLive && handsFree && !listening){
    setTimeout(()=>{ if(interviewLive && handsFree && !listening) startListening(); }, 300);
  }
}
```

- [ ] **Step 7: Make the mic button enter/exit hands-free mode**

Find:

```js
micBtn.onclick = ()=> listening ? (stopListening(), sendSpoken()) : startListening();
```

Replace with:

```js
micBtn.onclick = ()=>{
  if(listening){
    handsFree = false;
    stopListening(); sendSpoken();
  }else{
    handsFree = true;
    startListening();
  }
};
```

- [ ] **Step 8: Reset hands-free mode when the interview ends**

Find:

```js
function endInterview(){
  interviewLive=false; stopListening();
  stopAllSpeech();
  [textInput,sendBtn,shareBtn,hintBtn,feedbackBtn,micBtn].forEach(el=>el.disabled=true);
  startBtn.textContent="Start interview"; startBtn.classList.remove("live");
  problemSelect.disabled=false; setPresence("idle","idle");
}
```

Replace with:

```js
function endInterview(){
  interviewLive=false; handsFree=false; stopListening();
  stopAllSpeech();
  [textInput,sendBtn,shareBtn,hintBtn,feedbackBtn,micBtn].forEach(el=>el.disabled=true);
  startBtn.textContent="Start interview"; startBtn.classList.remove("live");
  problemSelect.disabled=false; setPresence("idle","idle");
}
```

- [ ] **Step 9: Manual verification**

In Chrome, local load, enter an Anthropic key, start an interview. Click the mic once, speak one full sentence out loud, then stop talking and wait without touching anything. Confirm: after roughly 1.2 seconds of silence, the app automatically stops listening and sends your sentence (it appears in the transcript as "you") — no second click needed. Confirm the mic visually re-engages (`.mic.rec` styling) a beat after Sam's spoken reply finishes, without you clicking it, so you can keep talking hands-free. Now click the mic again mid-sentence to manually interrupt: confirm it sends immediately on that click, and after Sam's next reply the mic does *not* automatically re-arm (hands-free was turned off by the manual click).

- [ ] **Step 10: Commit**

```bash
git add mock-interview-room.html
git commit -m "Auto-detect speech pauses to send hands-free, re-arm mic after replies"
```

---

### Task 5: Visual polish pass

**Files:**
- Modify: `mock-interview-room.html` (CSS only — `.drawer`, `.drawer-section`, `.drawer-label`, `.chip-row`, `.speed-row`, `#speedLabel`, and any spacing/typography adjustments within them)

**Interfaces:**
- Consumes: all structure/behavior from Tasks 1–4. This task changes visual styling only — it must not rename any ID, remove any element, or alter any JS logic.

- [ ] **Step 1: Invoke the frontend-design skill for guidance**

Run the `frontend-design` skill (via the Skill tool) to get direction on spacing, type hierarchy, and treatment for the new drawer/chip components, applied to this app's existing dark, amber/indigo-accented visual language (see `:root` custom properties already defined in the file — reuse them, don't introduce new colors).

- [ ] **Step 2: Apply refined CSS to the drawer/chip components**

Using the skill's guidance, adjust the rules added in Task 1 (`.drawer`, `.drawer-section`, `.drawer-label`, `.chip-row`, `.speed-row`, `#speedLabel`) for clearer visual hierarchy between the "Connection" and "Voice" sections, and a chip row that reads as a compact, intentional status summary rather than a leftover form row. Keep all existing class/ID names and DOM structure from Task 1 — this is a styling-only pass, not a markup change. Reuse existing CSS custom properties (`--panel-2`, `--line`, `--amber`, `--indigo`, `--muted`, `--text`, etc.) for consistency with the rest of the app.

- [ ] **Step 3: Manual verification**

Open in Chrome and re-run the full flow: drawer open by default → type a key → auto-collapse to chip → Edit reopens → adjust speed slider → toggle TTS mode → start an interview and confirm hands-free voice still works end-to-end (Task 4's checklist). Confirm nothing behaviorally changed — only appearance. Compare against the pre-Task-5 state (`git diff` or `git stash` toggle) to confirm only CSS values changed.

- [ ] **Step 4: Commit**

```bash
git add mock-interview-room.html
git commit -m "Polish visual treatment of the settings drawer and status chip"
```
