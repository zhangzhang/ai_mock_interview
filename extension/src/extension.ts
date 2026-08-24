import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.text = "$(comment-discussion) Onsite";
  status.tooltip = "Open the Onsite interview panel";
  status.command = "onsite.reveal";
  status.show();
  context.subscriptions.push(status);

  context.subscriptions.push(
    vscode.commands.registerCommand("onsite.reveal", () => {
      vscode.commands.executeCommand("onsite.samView.focus");
    })
  );
}

export function deactivate(): void {}
