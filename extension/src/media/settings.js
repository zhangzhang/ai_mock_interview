const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const MODELS = ["gpt-5.6", "gpt-5.5", "gpt-5", "gpt-5-mini", "gpt-5-nano"];
const STT = ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"];
const TTS = ["gpt-4o-mini-tts", "tts-1-hd", "tts-1"];
const VOICES = ["alloy","ash","ballad","coral","echo","fable","onyx","nova","sage","shimmer","verse","marin","cedar"];
function fill(sel, values) { for (const v of values) { const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o); } }
fill($("model"), MODELS); fill($("transcribeModel"), STT); fill($("ttsModel"), TTS); fill($("voice"), VOICES);

// The real key is never sent back to the webview. When one is saved we show a
// fixed mask (dots) in the field so it visibly reads as "stored"; typing replaces
// it, leaving the dots keeps the existing key.
const SAVED_MASK = "••••••••••••";
let hasSavedKey = false;
let keyTouched = false;

function apply(s, keyIsSet) {
  $("model").value = s.model; $("transcribeModel").value = s.transcribeModel;
  $("ttsModel").value = s.ttsModel; $("voice").value = s.voice; $("voiceMode").value = s.voiceMode;
  $("speechRate").value = String(s.speechRate); $("interviewerName").value = s.interviewerName;
  $("interviewerPronoun").value = s.interviewerPronoun;
  hasSavedKey = keyIsSet;
  keyTouched = false;
  $("apiKey").value = keyIsSet ? SAVED_MASK : "";
  $("keyNote").textContent = keyIsSet
    ? "A key is saved securely (OS keychain). Type to replace it, or leave the dots to keep it."
    : "No key saved yet. Your key is stored in VS Code SecretStorage, never in plaintext.";
}

$("apiKey").addEventListener("focus", () => {
  if (!keyTouched && $("apiKey").value === SAVED_MASK) $("apiKey").value = "";
});
$("apiKey").addEventListener("input", () => { keyTouched = true; });
$("apiKey").addEventListener("blur", () => {
  if (!keyTouched && hasSavedKey && $("apiKey").value === "") $("apiKey").value = SAVED_MASK;
});
function collect() {
  return {
    model: $("model").value, transcribeModel: $("transcribeModel").value, ttsModel: $("ttsModel").value,
    voice: $("voice").value, voiceMode: $("voiceMode").value, speechRate: parseFloat($("speechRate").value),
    interviewerName: $("interviewerName").value.trim() || "Sam", interviewerPronoun: $("interviewerPronoun").value,
  };
}
$("save").onclick = () => {
  const raw = $("apiKey").value;
  // Send a key only if the user actually typed a new one; the mask (or blank) means
  // "keep the existing key" (key: undefined). The host reposts init after saving,
  // which repopulates the mask so it's clear the key persisted.
  const key = (keyTouched && raw && raw !== SAVED_MASK) ? raw.trim() : undefined;
  vscode.postMessage({ type: "save", settings: collect(), key });
};
let testAudio = null;
function resetTestBtn() { $("test").disabled = false; $("test").textContent = "Test voice"; }
function stopTest() {
  if (testAudio) { try { testAudio.pause(); } catch (e) {} testAudio = null; }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
$("test").onclick = () => {
  stopTest();
  $("test").disabled = true;
  $("test").textContent = "Generating…";
  vscode.postMessage({ type: "testVoice", settings: collect() });
};
// The host synthesizes and sends the audio back here so playback happens in this
// page — where the click's user gesture lives (autoplay allowed) and independent
// of whether the interview panel is open.
function playTest(result) {
  if (result.kind === "audio") {
    $("test").textContent = "Playing…";
    const bin = atob(result.b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: "audio/mpeg" }));
    testAudio = new Audio(url);
    testAudio.onended = () => { URL.revokeObjectURL(url); testAudio = null; resetTestBtn(); };
    testAudio.onerror = () => { URL.revokeObjectURL(url); testAudio = null; resetTestBtn(); };
    testAudio.play().catch(() => resetTestBtn());
  } else if (result.kind === "browser") {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(result.text);
      u.rate = result.rate || 1; u.onend = resetTestBtn; u.onerror = resetTestBtn;
      $("test").textContent = "Playing…";
      speechSynthesis.speak(u);
    } else { resetTestBtn(); }
  } else {
    $("test").textContent = "Failed";
    $("keyNote").textContent = "Test voice failed: " + (result.message || "unknown error");
    setTimeout(resetTestBtn, 1500);
  }
}
window.addEventListener("message", (ev) => {
  const m = ev.data;
  if (m.type === "init") apply(m.settings, m.keyIsSet);
  else if (m.type === "testResult") playTest(m.result);
});
vscode.postMessage({ type: "ready" });
