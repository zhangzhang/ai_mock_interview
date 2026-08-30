const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const endpointer = makeEndpointer(); // from endpointing.js (inlined above this script)

let settings = null, muted = false, handsFree = false, listening = false, pendingHome = false;
let micStream = null, mediaRec = null, audioCtx = null, analyser = null, vadTimer = null;
let recChunks = [], heardSpeech = false, silenceMs = 0;
const VAD_INTERVAL = 100, SPEECH_RMS = 0.02, SILENCE_RMS = 0.012;

function addMsg(who, text) {
  const d = document.createElement("div");
  d.className = "msg " + who;
  d.textContent = text;
  $("transcript").appendChild(d);
  $("transcript").scrollTop = $("transcript").scrollHeight;
}
function presence(label) { $("status").textContent = label; }

// ---- problem picker + start ----
function renderProblems(groups) {
  const sel = $("problemSelect");
  sel.innerHTML = "";
  for (const g of groups) {
    const og = document.createElement("optgroup"); og.label = g.pattern;
    for (const it of g.items) {
      const o = document.createElement("option");
      o.value = it.id; o.textContent = `#${it.num} ${it.title} · ${it.diff}`;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
}
$("startBtn").onclick = () => {
  // Note: we do NOT auto-arm the mic. VS Code webviews block microphone access
  // (Permissions-Policy), so getUserMedia always fails here — auto-arming would
  // just spam a failure banner. The 🎤 button still lets the user try and see why.
  vscode.postMessage({ type: "startInterview", problemId: $("problemSelect").value });
};
$("settingsBtn").onclick = () => vscode.postMessage({ type: "openSettings" });
$("settingsBtn2").onclick = () => vscode.postMessage({ type: "openSettings" });
$("sendBtn").onclick = sendTyped;
$("textInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); sendTyped(); } });
$("hintBtn").onclick = () => vscode.postMessage({ type: "hint" });
$("shareBtn").onclick = () => vscode.postMessage({ type: "shareCode" });
$("endBtn").onclick = () => vscode.postMessage({ type: "endInterview" });
$("muteBtn").onclick = () => { muted = !muted; $("muteBtn").textContent = muted ? "🔇" : "🔊"; if (muted) stopAudio(); };
$("mic").onclick = () => { if (listening) stopListening(); else { handsFree = true; startListening(); } };

function sendTyped() {
  const t = $("textInput").value.trim();
  if (!t) return;
  $("textInput").value = "";
  vscode.postMessage({ type: "userText", text: t });
}

// ---- audio playback ----
let audioEl = null;
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch {} audioEl = null; }
  if (window.speechSynthesis) speechSynthesis.cancel(); }
function playTts(bytes) {
  stopAudio();
  const blob = new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  audioEl = new Audio(url);
  audioEl.onended = () => { audioEl = null; URL.revokeObjectURL(url); onSpeechEnd(); };
  audioEl.play().catch(() => onSpeechEnd());
}
function speakBrowser(text, rate) {
  if (!("speechSynthesis" in window)) { onSpeechEnd(); return; }
  stopAudio();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate || 1; u.onend = onSpeechEnd;
  speechSynthesis.speak(u);
}
function isSpeaking() { return !!audioEl || (("speechSynthesis" in window) && speechSynthesis.speaking); }
function goHome() {
  $("interview").hidden = true; $("home").hidden = false;
  handsFree = false; stopListening(); stopAudio();
}
function onSpeechEnd() {
  if (pendingHome) { pendingHome = false; goHome(); return; }
  if (handsFree && !listening) setTimeout(startListening, 300);
}

// ---- mic capture + VAD (adaptive endpointing) ----
async function ensureMic() {
  if (micStream) return true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048;
    audioCtx.createMediaStreamSource(micStream).connect(analyser);
    return true;
  } catch (e) {
    handsFree = false; // stop auto-retrying getUserMedia (avoids repeated prompts)
    $("banner").hidden = false;
    $("banner").innerHTML = "<b>Voice input isn't available inside VS Code.</b> Its webview blocks microphone access (a VS Code limitation, not your mic) — type your answers below. Sam still speaks aloud.";
    return false;
  }
}
function rms() {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}
async function startListening() {
  if (listening || !(await ensureMic())) return;
  if (audioCtx.state === "suspended") { try { await audioCtx.resume(); } catch {} }
  stopAudio();
  recChunks = []; heardSpeech = false; silenceMs = 0;
  mediaRec = new MediaRecorder(micStream);
  mediaRec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
  mediaRec.onstop = onRecStop;
  mediaRec.start();
  listening = true; $("mic").classList.add("rec"); presence("listening…");
  vadTimer = setInterval(() => {
    if (!listening) return;
    const v = rms();
    if (v > SPEECH_RMS) heardSpeech = true;
    if (heardSpeech) {
      if (v < SILENCE_RMS) { silenceMs += VAD_INTERVAL; if (silenceMs >= endpointer.current()) stopListening(); }
      else { if (silenceMs >= 300) endpointer.onResumedPause(silenceMs); silenceMs = 0; }
    }
  }, VAD_INTERVAL);
}
function stopListening() {
  if (!listening) return;
  listening = false; $("mic").classList.remove("rec");
  if (vadTimer) { clearInterval(vadTimer); vadTimer = null; }
  try { if (mediaRec && mediaRec.state !== "inactive") mediaRec.stop(); } catch {}
}
async function onRecStop() {
  const blob = new Blob(recChunks, { type: (mediaRec && mediaRec.mimeType) || "audio/webm" });
  recChunks = [];
  if (!heardSpeech || blob.size < 1500) { if (handsFree) setTimeout(startListening, 300); return; }
  presence("transcribing…");
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  vscode.postMessage({ type: "audioCaptured", bytes, mime: blob.type });
}

// ---- host messages ----
window.addEventListener("message", (ev) => {
  const m = ev.data;
  switch (m.type) {
    case "settings": settings = m.settings; $("nameLabel").textContent = settings.interviewerName; break;
    case "problems": renderProblems(m.groups); break;
    case "interviewStarted": $("home").hidden = true; $("interview").hidden = false;
      $("nameLabel").textContent = m.name; endpointer.reset(); break;
    case "presence": presence(m.label); break;
    case "userBubble": addMsg("you", m.text); break;
    case "samBubble": addMsg("sam", m.text); break;
    case "tts": if (!muted) playTts(m.bytes); else onSpeechEnd(); break;
    case "speakBrowser": if (!muted) speakBrowser(m.text, m.rate); else onSpeechEnd(); break;
    case "banner": $("banner").hidden = false; $("banner").innerHTML = m.html; break;
    case "endAfterSpeech": pendingHome = true; handsFree = false; if (!isSpeaking()) onSpeechEnd(); break;
    case "home": goHome(); break;
  }
});
vscode.postMessage({ type: "ready" });
