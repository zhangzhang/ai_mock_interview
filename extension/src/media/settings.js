const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const MODELS = ["gpt-5.6", "gpt-5.5", "gpt-5", "gpt-5-mini", "gpt-5-nano"];
const STT = ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"];
const TTS = ["gpt-4o-mini-tts", "tts-1-hd", "tts-1"];
const VOICES = ["alloy","ash","ballad","coral","echo","fable","onyx","nova","sage","shimmer","verse","marin","cedar"];
function fill(sel, values) { for (const v of values) { const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o); } }
fill($("model"), MODELS); fill($("transcribeModel"), STT); fill($("ttsModel"), TTS); fill($("voice"), VOICES);

function apply(s, keyIsSet) {
  $("model").value = s.model; $("transcribeModel").value = s.transcribeModel;
  $("ttsModel").value = s.ttsModel; $("voice").value = s.voice; $("voiceMode").value = s.voiceMode;
  $("speechRate").value = String(s.speechRate); $("interviewerName").value = s.interviewerName;
  $("interviewerPronoun").value = s.interviewerPronoun;
  $("keyNote").textContent = keyIsSet
    ? "A key is saved securely (OS keychain). Leave blank to keep it."
    : "No key saved yet. Your key is stored in VS Code SecretStorage, never in plaintext.";
}
function collect() {
  return {
    model: $("model").value, transcribeModel: $("transcribeModel").value, ttsModel: $("ttsModel").value,
    voice: $("voice").value, voiceMode: $("voiceMode").value, speechRate: parseFloat($("speechRate").value),
    interviewerName: $("interviewerName").value.trim() || "Sam", interviewerPronoun: $("interviewerPronoun").value,
  };
}
$("save").onclick = () => {
  const key = $("apiKey").value.trim();
  vscode.postMessage({ type: "save", settings: collect(), key: key || undefined });
  $("apiKey").value = "";
};
$("test").onclick = () => vscode.postMessage({ type: "testVoice", settings: collect() });
window.addEventListener("message", (ev) => { if (ev.data.type === "init") apply(ev.data.settings, ev.data.keyIsSet); });
vscode.postMessage({ type: "ready" });
