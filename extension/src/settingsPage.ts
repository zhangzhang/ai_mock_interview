import * as vscode from "vscode";
import * as fs from "fs";
import type { Settings } from "./store.ts";

function nonce(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
function read(ctx: vscode.ExtensionContext, p: string): string {
  return fs.readFileSync(vscode.Uri.joinPath(ctx.extensionUri, "src", "media", p).fsPath, "utf8");
}

export type TestVoiceResult =
  | { kind: "audio"; b64: string }
  | { kind: "browser"; text: string; rate: number }
  | { kind: "error"; message: string };

export interface SettingsHandlers {
  save(patch: Partial<Settings>, key?: string): Promise<{ settings: Settings; keyIsSet: boolean }>;
  testVoice(s: Settings): Promise<TestVoiceResult>;
}

let panel: vscode.WebviewPanel | undefined;

export function openSettingsPage(
  ctx: vscode.ExtensionContext, current: Settings, keyIsSet: boolean, handlers: SettingsHandlers
): void {
  // `current` is reassigned after a save so the page's snapshot stays fresh.
  if (panel) { panel.reveal(vscode.ViewColumn.Active); panel.webview.postMessage({ type: "init", settings: current, keyIsSet }); return; }
  panel = vscode.window.createWebviewPanel("onsiteSettings", "Onsite Settings", vscode.ViewColumn.Active,
    { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, "src", "media")] });
  const n = nonce();
  panel.webview.html = read(ctx, "settings.html")
    .replace(/{{cspSource}}/g, panel.webview.cspSource)
    .replace(/{{nonce}}/g, n)
    .replace("{{settingsCss}}", read(ctx, "settings.css"))
    .replace("{{settingsJs}}", read(ctx, "settings.js"));
  panel.webview.onDidReceiveMessage(async (m: any) => {
    if (m.type === "ready") panel!.webview.postMessage({ type: "init", settings: current, keyIsSet });
    else if (m.type === "save") {
      const res = await handlers.save(m.settings, m.key);
      current = res.settings;
      panel!.webview.postMessage({ type: "init", settings: res.settings, keyIsSet: res.keyIsSet });
      vscode.window.showInformationMessage("Onsite settings saved.");
    }
    else if (m.type === "testVoice") {
      const result = await handlers.testVoice({ ...current, ...m.settings });
      panel!.webview.postMessage({ type: "testResult", result });
    }
  });
  panel.onDidDispose(() => { panel = undefined; });
}
