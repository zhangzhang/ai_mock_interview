# Full OpenAI Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the whole app to a single OpenAI key — GPT-5 chat brain, OpenAI transcription for voice input (replacing the browser recognizer), and gpt-4o-mini-tts with the newest voices for output — while staying a static file.

**Architecture:** All in `mock-interview-room.html`. Order: brain+connection first (interviewer works on OpenAI), then unify the key for voice output + newest voices, then the big voice-input rewrite (MediaRecorder + VAD + transcription), then verify. Each commit leaves a loadable file.

**Tech Stack:** Vanilla JS, OpenAI REST (`/v1/chat/completions`, `/v1/audio/transcriptions`, `/v1/audio/speech`), MediaRecorder + Web Audio API.

## Global Constraints

- Single file, no build, no backend, no test framework (manual Chrome verification over http://localhost).
- One key field `#apiKey` (OpenAI) powers chat, transcription, and TTS.
- Bot models: `gpt-5.5` (default), `gpt-5`, `gpt-5-mini`, `gpt-5-nano`. Chat body uses `max_completion_tokens` + `reasoning_effort:"low"`, NO `temperature`, NO `max_tokens`.
- Transcription models: `gpt-4o-transcribe` (default), `gpt-4o-mini-transcribe`, `whisper-1`.
- Voice models: `gpt-4o-mini-tts` (default), `tts-1-hd`, `tts-1`. Voices add `verse`, `marin`, `cedar`.
- No `localStorage`/`sessionStorage`/`cookie`. No Anthropic/Claude/SpeechRecognition residue.

---

### Task 0: Branch

- [ ] Commit spec + plan, branch:
```bash
cd /Users/developer/workspace/interview
git add docs/superpowers/specs/2026-07-06-openai-only-brain-design.md docs/superpowers/plans/2026-07-06-full-openai-stack.md
git commit -q -m "Add full-OpenAI-stack spec and plan"
git checkout -q -b full-openai-stack
```

---

### Task 1: Brain → OpenAI chat completions + Connection section

**Files:** `mock-interview-room.html` — `ask()`, Connection markup, boot handler, copy strings, file comment.

- [ ] **ask() body/endpoint.** Replace the whole `try{ ... }catch` request block in `ask()` (the `if(key){...}else{...}` two-branch fetch + parse) with a single OpenAI call:
```js
  const key = (document.getElementById("apiKey").value||"").trim();
  try{
    const model = (document.getElementById("botModel").value||"").trim() || "gpt-5.5";
    const res = await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+key },
      body:JSON.stringify({
        model,
        messages:[{role:"system", content:systemPrompt()}, ...conversation],
        max_completion_tokens:2000,
        reasoning_effort:"low"
      })
    });
    const data = await res.json();
    if(data && data.error){ throw new Error(data.error.message || JSON.stringify(data.error)); }
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim()
      || "Sorry — could you say that again?";
    conversation.push({role:"assistant", content:text});
    addMsg("sam", text);
    speak(text);
  }catch(e){
    conversation.pop();
    const msg = (e && e.message) ? e.message : String(e);
    addMsg("system","(Couldn't reach your interviewer: "+msg+")");
    if(!key) showBanner("<b>"+interviewerDisplayName()+" needs an OpenAI API key.</b> Open Settings (the ⚙ icon) and paste your OpenAI key (sk-…). Get one at platform.openai.com. It stays in this tab. Then try again.","err");
    setPresence("idle","idle");
  }
```
Remove the leading `conversation.push({role:"user",...})`? No — keep the existing `conversation.push({role:"user", content:userContent}); setPresence("thinking","thinking…");` lines at the top of ask() unchanged.

- [ ] **Connection markup.** Replace the Connection section's `.keyrow` (the `#apiKey` Anthropic input + `#apiModel`) with the OpenAI key + bot model + note:
```html
          <div class="modal-section" id="connectionSection">
            <div class="modal-label">Connection</div>
            <div class="keyrow" id="keyrow">
              <input id="apiKey" type="password" autocomplete="off" placeholder="OpenAI API key (sk-…)">
              <select id="botModel" title="Interviewer model">
                <option value="gpt-5.5" selected>gpt-5.5</option>
                <option value="gpt-5">gpt-5</option>
                <option value="gpt-5-mini">gpt-5-mini</option>
                <option value="gpt-5-nano">gpt-5-nano</option>
              </select>
            </div>
            <div class="key-note">Your key stays in this browser tab only — never saved, and sent only to OpenAI.</div>
          </div>
```

- [ ] **CSS for key-note and botModel.** After `.keyrow input:focus{...}` add:
```css
  .keyrow select{background:#14161d;border:1px solid var(--line);border-radius:9px;
    padding:9px 10px;color:var(--text);font-size:12.5px;font-family:var(--ui);flex:0 0 128px;width:128px}
  .keyrow select:focus{outline:none;border-color:var(--amber)}
  .key-note{font-size:11px;color:var(--muted);line-height:1.4;margin-top:-2px}
```

- [ ] **Always show Connection.** In the boot handler's `if(embedded){ ... }` branch, remove the line `document.getElementById("connectionSection").style.display="none";`.

- [ ] **Copy cleanup.** Boot banner (local branch) → replace Anthropic text with:
```js
    showBanner("<b>Paste your OpenAI API key in Settings to wake "+interviewerDisplayName()+".</b> Get one at platform.openai.com. It stays in this browser tab and is sent only to OpenAI. Serve over http://localhost for the mic to work smoothly.");
```
File top comment: change `Sam (powered by Claude)` → `Sam (powered by OpenAI)`.

- [ ] **JS syntax check + commit:**
```bash
python3 -c "import re;s=open('mock-interview-room.html').read();open('/tmp/c.js','w').write(re.search(r'<script>(.*)</script>',s,re.S).group(1))"; node --check /tmp/c.js
git commit -qam "Brain: OpenAI GPT-5 chat completions; single OpenAI key + bot-model dropdown"
```
Verify: `grep -n "anthropic\|apiModel" mock-interview-room.html` → none.

---

### Task 2: Voice output — unify key, newest voices

**Files:** `mock-interview-room.html` — neural row markup, `speak()`/`speakNeural()`, section label.

- [ ] **Remove #openaiKey from neural row; add voices.** Replace the `#neuralRow` inner markup so it drops the key input and extends `#openaiVoice`:
```html
              <div class="vrow" id="neuralRow" style="display:none">
                <select id="openaiVoice" title="Voice">
                  <option value="alloy">Alloy</option><option value="ash">Ash</option>
                  <option value="ballad">Ballad</option><option value="coral">Coral</option>
                  <option value="echo">Echo</option><option value="fable">Fable</option>
                  <option value="onyx" selected>Onyx</option><option value="nova">Nova</option>
                  <option value="sage">Sage</option><option value="shimmer">Shimmer</option>
                  <option value="verse">Verse</option><option value="marin">Marin</option><option value="cedar">Cedar</option>
                </select>
                <select id="openaiModel" title="Model">
                  <option value="gpt-4o-mini-tts" selected>4o-mini-tts</option>
                  <option value="tts-1-hd">tts-1-hd</option>
                  <option value="tts-1">tts-1</option>
                </select>
              </div>
              <div class="key-note" id="voiceNote">Marin, Cedar, Verse & Ballad need the 4o-mini-tts model.</div>
```

- [ ] **speak() key source.** In `speak()`, change the neural decision to read `#apiKey`:
```js
function speak(text){
  if(muted){ onSpeechEnd(); return; }
  const oaKey = (document.getElementById("apiKey").value||"").trim();
  if(ttsMode==="neural" && oaKey){ speakNeural(text); return; }
  speakBrowser(text);
}
```

- [ ] **speakNeural() key source.** Change `const key = document.getElementById("openaiKey").value.trim();` → `const key = (document.getElementById("apiKey").value||"").trim();`

- [ ] **Relabel section.** Change the Voice section label text `Voice` → `Interviewer voice`.

- [ ] **Syntax + commit:**
```bash
python3 -c "import re;s=open('mock-interview-room.html').read();open('/tmp/c.js','w').write(re.search(r'<script>(.*)</script>',s,re.S).group(1))"; node --check /tmp/c.js
grep -n "openaiKey" mock-interview-room.html   # expect none
git commit -qam "Voice output: single key, add newest TTS voices (marin/cedar/verse)"
```

---

### Task 3: Voice input — OpenAI transcription (replace Web Speech)

**Files:** `mock-interview-room.html` — the entire STT block, `startListening`/`stopListening`, `sendSpoken`, `micBtn.onclick`, `endInterview`, plus a new "Your voice (input)" settings section + `#sttModel`.

- [ ] **Add the input settings section** between Interviewer and Voice sections:
```html
          <div class="modal-section" id="inputSection">
            <div class="modal-label">Your voice (input)</div>
            <div class="vrow">
              <select id="sttModel" title="Transcription model">
                <option value="gpt-4o-transcribe" selected>gpt-4o-transcribe</option>
                <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe</option>
                <option value="whisper-1">whisper-1</option>
              </select>
            </div>
          </div>
```
CSS: `#inputSection select{background:#14161d;border:1px solid var(--line);border-radius:8px;padding:8px 10px;color:var(--text);font-size:12.5px;font-family:var(--ui);flex:1;min-width:0} #inputSection select:focus{outline:none;border-color:var(--amber)}`

- [ ] **Replace the STT block.** Replace everything from `const SR = window.SpeechRecognition...` through the end of `stopListening(){...}` with the transcription engine:
```js
/* ============================ voice in (transcription) ============================ */
const PAUSE_MS = 1200, VAD_INTERVAL = 100, SPEECH_RMS = 0.02, SILENCE_RMS = 0.012;
let listening = false, handsFree = false;
let micStream = null, mediaRec = null, recChunks = [], audioCtx = null, analyser = null;
let vadTimer = null, heardSpeech = false, silenceMs = 0;
let sttOK = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

async function ensureMic(){
  if(micStream) return true;
  try{
    micStream = await navigator.mediaDevices.getUserMedia({audio:true});
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048;
    src.connect(analyser);
    return true;
  }catch(err){
    sttOK=false; micBtn.disabled=true; micBtn.classList.remove("rec");
    showBanner("<b>Mic blocked ("+((err&&err.name)||"denied")+").</b> Allow the microphone (serve over http://localhost), or type your responses below.", "err");
    return false;
  }
}
function micRms(){
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let s=0; for(let i=0;i<buf.length;i++) s+=buf[i]*buf[i];
  return Math.sqrt(s/buf.length);
}
function pickMime(){
  const c=["audio/webm;codecs=opus","audio/webm","audio/mp4"];
  for(const t of c){ if(window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t; }
  return "";
}
async function startListening(){
  if(listening) return;
  if(!sttOK){ setNote("Voice input isn't available here — type your response.", true); return; }
  if(!(await ensureMic())) return;
  if(audioCtx.state==="suspended"){ try{ await audioCtx.resume(); }catch(_){} }
  stopAllSpeech();
  recChunks=[]; heardSpeech=false; silenceMs=0;
  const mime = pickMime();
  try{ mediaRec = mime ? new MediaRecorder(micStream,{mimeType:mime}) : new MediaRecorder(micStream); }
  catch(_){ mediaRec = new MediaRecorder(micStream); }
  mediaRec.ondataavailable = e=>{ if(e.data && e.data.size) recChunks.push(e.data); };
  mediaRec.onstop = onRecStop;
  mediaRec.start();
  listening=true; micBtn.classList.add("rec");
  if(!speaking()) setPresence("listening","listening…");
  vadTimer = setInterval(()=>{
    if(!listening) return;
    const v = micRms();
    if(v > SPEECH_RMS) heardSpeech = true;
    if(heardSpeech){
      if(v < SILENCE_RMS){ silenceMs += VAD_INTERVAL; if(silenceMs >= PAUSE_MS) stopListening(); }
      else silenceMs = 0;
    }
  }, VAD_INTERVAL);
}
function stopListening(){
  if(!listening) return;
  listening=false; micBtn.classList.remove("rec");
  if(vadTimer){ clearInterval(vadTimer); vadTimer=null; }
  try{ if(mediaRec && mediaRec.state!=="inactive") mediaRec.stop(); }catch(_){}
  if(!speaking()) setPresence("idle", interviewLive?"idle":"idle");
}
function rearmListen(){ setTimeout(()=>{ if(interviewLive && handsFree && !listening) startListening(); }, 300); }
async function onRecStop(){
  const blob = new Blob(recChunks, {type:(mediaRec && mediaRec.mimeType) || "audio/webm"});
  recChunks=[];
  if(!heardSpeech || blob.size < 1500){ if(interviewLive && handsFree) rearmListen(); return; }
  setPresence("thinking","transcribing…");
  try{
    const text = await transcribe(blob);
    if(text && text.trim()){ textInput.value = text.trim(); sendSpoken(); }
    else if(interviewLive && handsFree){ rearmListen(); }
  }catch(e){
    setNote("Transcription failed ("+(e.message||e)+"). You can type instead.", true);
    if(interviewLive && handsFree) rearmListen();
  }
}
async function transcribe(blob){
  const key = (document.getElementById("apiKey").value||"").trim();
  if(!key) throw new Error("no OpenAI key");
  const model = (document.getElementById("sttModel").value||"gpt-4o-transcribe");
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  fd.append("model", model);
  fd.append("response_format","json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions",{
    method:"POST", headers:{ "Authorization":"Bearer "+key }, body:fd
  });
  if(!res.ok){ let m="HTTP "+res.status; try{ const j=await res.json(); m=(j.error&&j.error.message)||m; }catch(_){} throw new Error(m); }
  const data = await res.json();
  return data.text || "";
}
```

- [ ] **sendSpoken()** — remove the now-undefined `heard=""`:
```js
function sendSpoken(){
  const spoken = textInput.value.trim();
  if(!spoken){ return; }
  if(listening) stopListening();
  addMsg("you", spoken);
  textInput.value="";
  ask(buildTurn(spoken));
}
```

- [ ] **micBtn.onclick** — manual stop just stops (onRecStop sends); no direct sendSpoken:
```js
micBtn.onclick = ()=>{
  if(listening){ handsFree=false; stopListening(); }
  else { handsFree=true; startListening(); }
};
```

- [ ] **endInterview** — already sets `handsFree=false; stopListening();`. Leave as is (stopListening now clears VAD + recorder).

- [ ] **onSpeechEnd** re-arm — unchanged (already re-arms via startListening when `interviewLive && handsFree && !listening`).

- [ ] **Syntax + residue check + commit:**
```bash
python3 -c "import re;s=open('mock-interview-room.html').read();open('/tmp/c.js','w').write(re.search(r'<script>(.*)</script>',s,re.S).group(1))"; node --check /tmp/c.js
grep -n "SpeechRecognition\|webkitSpeechRecognition\|recog\|micGranted\|\\bheard\\b" mock-interview-room.html   # expect none
git commit -qam "Voice input: OpenAI transcription (MediaRecorder + VAD) replaces Web Speech"
```

---

### Task 4: Manual verification

- [ ] Serve over localhost, drive in a real browser (Playwright): confirm Settings has 4 sections (Connection w/ OpenAI key + bot model + note, Interviewer, Your voice input w/ transcription model, Interviewer voice output w/ new voices, one key field total); intercept and confirm chat → `/v1/chat/completions` (gpt-5 model, `max_completion_tokens`, `reasoning_effort`, no `temperature`), transcription request shape, TTS with new voices; grep for residue. Then merge to main.
