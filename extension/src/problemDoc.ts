import * as vscode from "vscode";
import type { Problem } from "./problems.ts";
import { formatProblemMarkdown, getProblem } from "./problems.ts";

export const PROBLEM_SCHEME = "onsite-problem";

export function registerProblemScheme(context: vscode.ExtensionContext): void {
  const provider: vscode.TextDocumentContentProvider = {
    provideTextDocumentContent(uri) {
      const p = getProblem(uri.path.replace(/\.md$/, ""));
      return p ? formatProblemMarkdown(p) : "# Problem not found";
    },
  };
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PROBLEM_SCHEME, provider)
  );
}

export async function openProblemDocs(problem: Problem): Promise<vscode.TextDocument> {
  // Column 1: an untitled Java document with the starter skeleton.
  const doc = await vscode.workspace.openTextDocument({ language: "java", content: problem.starter });
  await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preview: false });

  // Column 2: read-only markdown preview of the problem.
  const uri = vscode.Uri.parse(`${PROBLEM_SCHEME}:${problem.id}.md`);
  await vscode.commands.executeCommand("markdown.showPreviewToSide", uri);

  return doc;
}

export function readSolution(doc: vscode.TextDocument): string {
  return doc.getText();
}
