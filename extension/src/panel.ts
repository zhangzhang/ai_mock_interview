import * as vscode from "vscode";
import * as fs from "fs";
import type { Settings } from "./store.ts";

function nonce(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
function read(ctx: vscode.ExtensionContext, p: string): string {
  return fs.readFileSync(vscode.Uri.joinPath(ctx.extensionUri, "src", "media", p).fsPath, "utf8");
}

export type PanelToHost =
  | { type: "ready" } | { type: "startInterview"; problemId: string }
  | { type: "userText"; text: string } | { type: "audioCaptured"; bytes: number[]; mime: string }
  | { type: "hint" } | { type: "shareCode" } | { type: "endInterview" } | { type: "openSettings" };

export type HostToPanel =
  | { type: "settings"; settings: Settings }
  | { type: "problems"; groups: { pattern: string; items: { id: string; num: number; title: string; diff: string }[] }[] }
  | { type: "interviewStarted"; name: string }
  | { type: "presence"; state: string; label: string }
  | { type: "userBubble"; text: string } | { type: "samBubble"; text: string }
  | { type: "tts"; bytes: number[] } | { type: "speakBrowser"; text: string; rate: number }
  | { type: "banner"; html: string; kind: string } | { type: "home" } | { type: "endAfterSpeech" };

export class SamViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private handler?: (m: PanelToHost) => void;
  constructor(private ctx: vscode.ExtensionContext) {}

  onMessage(cb: (m: PanelToHost) => void): void { this.handler = cb; }
  post(msg: HostToPanel): void { this.view?.webview.postMessage(msg); }
  reveal(): void { this.view?.show?.(true); }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, "src", "media")] };
    const n = nonce();
    view.webview.html = read(this.ctx, "panel.html")
      .replace(/{{cspSource}}/g, view.webview.cspSource)
      .replace(/{{nonce}}/g, n)
      .replace("{{panelCss}}", read(this.ctx, "panel.css"))
      .replace("{{endpointingJs}}", read(this.ctx, "endpointing.js").replace(/export /g, ""))
      .replace("{{panelJs}}", read(this.ctx, "panel.js"));
    view.webview.onDidReceiveMessage((m: PanelToHost) => this.handler?.(m));
  }
}
