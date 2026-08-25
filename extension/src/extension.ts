import * as vscode from "vscode";
import { SamViewProvider, PanelToHost } from "./panel.ts";
import { openSettingsPage } from "./settingsPage.ts";
import { registerProblemScheme, openProblemDocs, readSolution } from "./problemDoc.ts";
import { problemsByPattern, getProblem } from "./problems.ts";
import { getSettings, setSettings, getKey, setKey, Settings } from "./store.ts";
import { InterviewSession } from "./interview.ts";
import { chatCompletion, transcribe, synthesizeSpeech } from "./openai.ts";
import { GREETING_HINT, HINT_INSTRUCTION, FEEDBACK_INSTRUCTION } from "./prompt.ts";

export function activate(context: vscode.ExtensionContext): void {
  registerProblemScheme(context);

  const provider = new SamViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("onsite.samView", provider, { webviewOptions: { retainContextWhenHidden: true } })
  );

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.text = "$(comment-discussion) Onsite";
  status.tooltip = "Open the Onsite interview panel";
  status.command = "onsite.reveal";
  status.show();
  context.subscriptions.push(status);
  context.subscriptions.push(
    vscode.commands.registerCommand("onsite.reveal", () => vscode.commands.executeCommand("onsite.samView.focus")),
    vscode.commands.registerCommand("onsite.openSettings", () => showSettings())
  );

  let session: InterviewSession | undefined;
  let solutionDoc: vscode.TextDocument | undefined;
  let busy = false;
  async function withBusy(fn: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    try { await fn(); } finally { busy = false; }
  }

  const persona = () => {
    const s = getSettings(context.globalState);
    return { name: s.interviewerName, pronoun: s.interviewerPronoun };
  };
  const settings = () => getSettings(context.globalState);

  function sendSettings() { provider.post({ type: "settings", settings: settings() }); }
  function sendProblems() {
    const groups = problemsByPattern().map((g) => ({
      pattern: g.pattern,
      items: g.items.map((p) => ({ id: p.id, num: p.num, title: p.title, diff: p.diff })),
    }));
    provider.post({ type: "problems", groups });
  }

  async function requireKey(): Promise<string | undefined> {
    const key = await getKey(context.secrets);
    if (!key) {
      provider.post({ type: "banner", kind: "err",
        html: "Add your OpenAI key in <b>⚙ Settings</b> to start." });
      showSettings();
      return undefined;
    }
    return key;
  }

  async function showSettings() {
    let k = "";
    try { k = await getKey(context.secrets); } catch { /* keychain unavailable */ }
    openSettingsPage(context, settings(), !!k, {
      save: async (patch, key) => { await setSettings(context.globalState, patch); if (key !== undefined) await setKey(context.secrets, key); sendSettings(); },
      testVoice: async (s) => { await speak("Hi, I'm " + s.interviewerName + ". Let's begin when you're ready.", s); },
    });
  }

  async function speak(text: string, s: Settings): Promise<void> {
    if (s.voiceMode === "browser") { provider.post({ type: "speakBrowser", text, rate: s.speechRate }); return; }
    const key = await getKey(context.secrets);
    if (!key) return;
    try {
      const bytes = await synthesizeSpeech(key, s.ttsModel, s.voice, text, s.speechRate);
      provider.post({ type: "tts", bytes: Array.from(bytes) });
    } catch { provider.post({ type: "speakBrowser", text, rate: s.speechRate }); }
  }

  async function runAssistantTurn(sendMessages: Parameters<typeof chatCompletion>[2]): Promise<void> {
    const key = await requireKey(); if (!key) return;
    const s = settings();
    provider.post({ type: "presence", state: "thinking", label: "thinking…" });
    try {
      const reply = await chatCompletion(key, s.model, sendMessages);
      if (!session) return;
      session!.pushAssistant(reply);
      provider.post({ type: "samBubble", text: reply });
      await speak(reply, s);
      provider.post({ type: "presence", state: "idle", label: "listening for you" });
    } catch (e: any) {
      provider.post({ type: "banner", kind: "err", html: "Couldn't reach OpenAI: " + (e?.message || e) });
      provider.post({ type: "presence", state: "idle", label: "idle" });
    }
  }

  async function userTurn(text: string): Promise<void> {
    if (!session || !solutionDoc) return;
    provider.post({ type: "userBubble", text });
    const java = readSolution(solutionDoc);
    const toSend = session.turnMessages(text, java);
    session.pushUser(`${text}\n\n(code shared)`);
    await runAssistantTurn(toSend);
  }

  provider.onMessage(async (m: PanelToHost) => {
    switch (m.type) {
      case "ready": sendSettings(); sendProblems(); break;
      case "openSettings": showSettings(); break;
      case "startInterview": {
        const p = getProblem(m.problemId); if (!p) break;
        if (!(await requireKey())) break;
        await withBusy(async () => {
          solutionDoc = await openProblemDocs(p);
          session = new InterviewSession(persona(), p);
          provider.reveal();
          provider.post({ type: "interviewStarted", name: settings().interviewerName });
          await runAssistantTurn([...session.messages(), { role: "user", content: GREETING_HINT }]);
        });
        break;
      }
      case "userText": await withBusy(() => userTurn(m.text)); break;
      case "audioCaptured": {
        const key = await requireKey(); if (!key || !session) break;
        await withBusy(async () => {
          provider.post({ type: "presence", state: "thinking", label: "transcribing…" });
          try {
            const text = await transcribe(key, settings().transcribeModel, new Uint8Array(m.bytes), m.mime);
            if (text) await userTurn(text);
            else provider.post({ type: "presence", state: "idle", label: "listening for you" });
          } catch (e: any) {
            provider.post({ type: "banner", kind: "err", html: "Transcription failed: " + (e?.message || e) });
          }
        });
        break;
      }
      case "hint": if (session) await withBusy(() => runAssistantTurn([...session!.messages(), { role: "user", content: HINT_INSTRUCTION }])); break;
      case "shareCode": if (session && solutionDoc) await withBusy(() => userTurn("Here's my current code — what do you think?")); break;
      case "endInterview":
        if (session) {
          await withBusy(() => runAssistantTurn([...session!.messages(), { role: "user", content: FEEDBACK_INSTRUCTION }]));
          session = undefined; solutionDoc = undefined;
          provider.post({ type: "endAfterSpeech" });
        } else {
          provider.post({ type: "home" });
        }
        break;
    }
  });
}

export function deactivate(): void {}
