# Onsite VS Code Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Onsite mock-interview web app into a button-driven VS Code extension where the candidate codes in a real editor, the problem shows beside it, and "Sam" (voice + chat) runs in the bottom Panel — with all OpenAI calls made by the Node extension host (no CORS, no proxy).

**Architecture:** Two processes. The **extension host** (Node/TypeScript, bundled by esbuild to CommonJS) owns the problem bank, the OpenAI client, secret/state storage, and interview orchestration. Two **webviews** (Chromium) hold no key and make no API calls: the **Sam view** in the bottom Panel (mic capture + adaptive-endpointing VAD + audio playback + transcript UI) and a **settings page** in the editor area. They talk to the host via `postMessage`.

**Tech Stack:** TypeScript, VS Code Extension API, esbuild (host bundle), vanilla JS/CSS (webviews), Node built-in `fetch`, `node:test` via `tsx` loader for unit tests, `@vscode/vsce` for packaging.

## Global Constraints

- All new code lives under `extension/`. Do **not** modify the root web app, `proxy/`, `index.html`, or root `README.md`.
- Extension host bundle is **CommonJS** (VS Code requirement); `vscode` is an external, never bundled.
- Pure-logic modules (`problems.ts`, `prompt.ts`, `openai.ts`, `store.ts`) MUST NOT `import` the `vscode` module at runtime — `import type` only — so they are unit-testable outside the extension host.
- OpenAI chat requests use GPT-5 reasoning params verbatim: `max_completion_tokens: 2000`, `reasoning_effort: "low"`, **no** `temperature`; read text from `data.choices[0].message.content`.
- Default settings: model `gpt-5.6`; transcription `gpt-4o-transcribe`; TTS model `gpt-4o-mini-tts`; voice `onyx`; `voiceMode` `neural`; `speechRate` `1`; interviewer name `Sam`; pronoun `they`.
- Adaptive endpointing: pause adapts within `[800, 5000]` ms, default `2500`, margin `700`, min sample `300`, rolling window `20`, 90th-percentile rule (ported from the web app).
- Node's global `fetch` is used for all HTTP. `openai.ts` functions take an injectable `fetchImpl` parameter defaulting to global `fetch`, so tests pass a mock.
- Test command: `node --import tsx --test "test/**/*.test.ts"` run from `extension/`.
- Commit after every task. Never use `temperature` or `max_tokens` for chat.
- The problem bank and Java starter skeletons are ported from the repo's `mock-interview-room.html` (the `PROBLEMS`/`P()`/`STARTERS` data is the source of truth) — 94 problems.

---

## File Structure

```
extension/
  package.json          # manifest: panel view, commands (button wiring), status bar, activation
  tsconfig.json
  esbuild.js            # bundles src/extension.ts -> out/extension.js (CJS, external vscode)
  .vscodeignore
  src/
    extension.ts        # activate(): register panel provider, settings page, status bar, routing
    problems.ts         # PROBLEMS bank + skeletons + grouping + formatProblemMarkdown() (pure)
    prompt.ts           # systemPrompt() + greeting/hint/feedback instruction builders (pure)
    openai.ts           # chatCompletion(), transcribe(), synthesizeSpeech() (pure, injectable fetch)
    store.ts            # Settings type + defaults; getSettings/setSettings/getKey/setKey (pure-ish)
    interview.ts        # InterviewSession: conversation state + turn orchestration (host glue)
    problemDoc.ts       # untitled Solution.java + problem markdown preview (vscode glue)
    panel.ts            # Sam bottom-panel WebviewViewProvider (host side of the bridge)
    settingsPage.ts     # settings editor-area webview (host side of the bridge)
    media/
      panel.html panel.js panel.css        # Sam UI: transcript, VAD, mic, audio playback
      settings.html settings.js settings.css  # settings form + Test voice
  test/
    problems.test.ts
    prompt.test.ts
    openai.test.ts
    store.test.ts
    endpointing.test.ts   # tests media/endpointing.js (shared pure JS module)
```

Note: adaptive-endpointing math is factored into `src/media/endpointing.js` (a plain ES module, imported by both `panel.js` in the webview and the test), to keep it DRY and tested.

---

### Task 1: Scaffold the extension (builds + packages)

**Files:**
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/esbuild.js`
- Create: `extension/.vscodeignore`
- Create: `extension/src/extension.ts`

**Interfaces:**
- Produces: `activate(context)` / `deactivate()` entry points; npm scripts `compile`, `watch`, `test`, `package`.

- [ ] **Step 1: Create `extension/package.json`**

```json
{
  "name": "onsite-interview",
  "displayName": "Onsite — mock interview",
  "description": "Voice-driven mock coding interviews inside VS Code.",
  "version": "0.1.0",
  "publisher": "onsite",
  "license": "MIT",
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Other"],
  "main": "./out/extension.js",
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "viewsContainers": {
      "panel": [
        { "id": "onsitePanel", "title": "Onsite", "icon": "$(comment-discussion)" }
      ]
    },
    "views": {
      "onsitePanel": [
        { "id": "onsite.samView", "type": "webview", "name": "Interview" }
      ]
    },
    "commands": [
      { "command": "onsite.reveal", "title": "Onsite: Show Interview Panel" },
      { "command": "onsite.openSettings", "title": "Onsite: Settings" }
    ]
  },
  "scripts": {
    "compile": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "test": "node --import tsx --test \"test/**/*.test.ts\"",
    "package": "npm run compile && vsce package --no-dependencies"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.90.0",
    "@vscode/vsce": "^3.0.0",
    "esbuild": "^0.23.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create `extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "outDir": "out",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "out"]
}
```

- [ ] **Step 3: Create `extension/esbuild.js`**

```js
const esbuild = require("esbuild");
const watch = process.argv.includes("--watch");
const opts = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
};
(async () => {
  if (watch) { const ctx = await esbuild.context(opts); await ctx.watch(); }
  else { await esbuild.build(opts); }
})();
```

- [ ] **Step 4: Create `extension/.vscodeignore`**

```
.vscode/**
src/**
test/**
tsconfig.json
esbuild.js
node_modules/**
**/*.map
!out/**
```

- [ ] **Step 5: Create a minimal `extension/src/extension.ts`**

```ts
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
```

- [ ] **Step 6: Install deps and build**

Run: `cd extension && npm install && npm run compile`
Expected: `out/extension.js` is created; no errors.

- [ ] **Step 7: Package smoke test**

Run: `cd extension && npx vsce package --no-dependencies`
Expected: an `onsite-interview-0.1.0.vsix` is produced (a warning about a missing README/icon is fine).

- [ ] **Step 8: Commit**

```bash
git add extension/package.json extension/tsconfig.json extension/esbuild.js extension/.vscodeignore extension/src/extension.ts
git commit -m "feat(ext): scaffold VS Code extension (builds + packages)"
```

---

### Task 2: Problem bank (`problems.ts`)

**Files:**
- Create: `extension/src/problems.ts`
- Test: `extension/test/problems.test.ts`

**Interfaces:**
- Produces:
  - `interface Problem { id: string; num: number; title: string; diff: "easy"|"medium"|"hard"; pattern: string; url: string; descHtml: string; starter: string; }`
  - `const PROBLEMS: Problem[]`
  - `function problemsByPattern(): { pattern: string; items: Problem[] }[]`
  - `function getProblem(id: string): Problem | undefined`
  - `function formatProblemMarkdown(p: Problem): string`

- [ ] **Step 1: Write the failing test**

```ts
// extension/test/problems.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROBLEMS, getProblem, problemsByPattern, formatProblemMarkdown } from "../src/problems.ts";

test("bank has the ported problems and no dupes", () => {
  assert.ok(PROBLEMS.length >= 90, `expected >=90, got ${PROBLEMS.length}`);
  const ids = new Set(PROBLEMS.map((p) => p.id));
  assert.equal(ids.size, PROBLEMS.length, "duplicate problem ids");
});

test("every problem has a real Java starter and required fields", () => {
  for (const p of PROBLEMS) {
    assert.match(p.starter, /class|interface|enum/, `${p.id} starter not Java`);
    assert.ok(p.title && p.pattern && p.url, `${p.id} missing fields`);
    assert.ok(["easy", "medium", "hard"].includes(p.diff), `${p.id} bad diff`);
  }
});

test("known problems resolve with correct signatures", () => {
  assert.match(getProblem("two-sum")!.starter, /public int\[\] twoSum\(int\[\] nums, int target\)/);
  assert.match(getProblem("flood-fill")!.starter, /floodFill\(int\[\]\[\] image, int sr, int sc, int color\)/);
  assert.ok(getProblem("nope") === undefined);
});

test("grouping preserves all problems", () => {
  const groups = problemsByPattern();
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  assert.equal(total, PROBLEMS.length);
});

test("markdown includes title, difficulty and reference link", () => {
  const md = formatProblemMarkdown(getProblem("two-sum")!);
  assert.match(md, /# .*Two Sum/);
  assert.match(md, /easy/i);
  assert.match(md, /leetcode\.com/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL — cannot find `../src/problems.ts`.

- [ ] **Step 3: Port the bank into `extension/src/problems.ts`**

Port the data from the repo's `mock-interview-room.html`. In that file, find the `sol()`, `solNode()`, `STARTERS` map, and the `P(...)` / `PROBLEMS` array (search for `const STARTERS` and `const PROBLEMS`). Reproduce them as TypeScript. Structure:

```ts
export interface Problem {
  id: string; num: number; title: string;
  diff: "easy" | "medium" | "hard";
  pattern: string; url: string; descHtml: string; starter: string;
}

const sol = (sig: string) => `class Solution {\n    ${sig} {\n        \n    }\n}`;
const solNode = (note: string, sig: string) => `// Definition: ${note}\n${sol(sig)}`;
const TN = "TreeNode { int val; TreeNode left, right; }";
const LN = "ListNode { int val; ListNode next; }";

// Port the full STARTERS map from mock-interview-room.html verbatim (keys = slugs).
const STARTERS: Record<string, string> = {
  "two-sum": sol("public int[] twoSum(int[] nums, int target)"),
  "flood-fill": sol("public int[][] floodFill(int[][] image, int sr, int sc, int color)"),
  // ... all remaining entries copied from the HTML ...
};

interface Raw { num: number; diff: Problem["diff"]; pattern: string; slug: string; title: string; desc: string; ex: string; con: string; }

function build(r: Raw): Problem {
  const url = `https://leetcode.com/problems/${r.slug}/`;
  let descHtml = `<p>${r.desc}</p>`;
  if (r.ex) descHtml += `<h4>Example</h4><pre>${r.ex}</pre>`;
  if (r.con) descHtml += `<h4>Constraints</h4><p>${r.con}</p>`;
  let starter = STARTERS[r.slug] || `class Solution {\n    // #${r.num} ${r.title}\n}`;
  if (/List<|Map<|Set<|Deque|PriorityQueue/.test(starter)) starter = "import java.util.*;\n\n" + starter;
  return { id: r.slug, num: r.num, title: r.title, diff: r.diff, pattern: r.pattern, url, descHtml, starter };
}

// Port each P(num, diff, pattern, slug, title, desc, ex, con) call as a Raw object.
const RAW: Raw[] = [
  { num: 1, diff: "easy", pattern: "Arrays & Hashing", slug: "two-sum", title: "Two Sum",
    desc: "Given an integer array and a target, return the indices of the two values that add up to the target.",
    ex: "nums = [2,7,11,15], target = 9  ->  [0,1]", con: "" },
  // ... all remaining problems copied from the HTML's PROBLEMS array ...
];

export const PROBLEMS: Problem[] = RAW.map(build);

export function getProblem(id: string): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}

export function problemsByPattern(): { pattern: string; items: Problem[] }[] {
  const order: string[] = [];
  const map = new Map<string, Problem[]>();
  for (const p of PROBLEMS) {
    if (!map.has(p.pattern)) { map.set(p.pattern, []); order.push(p.pattern); }
    map.get(p.pattern)!.push(p);
  }
  return order.map((pattern) => ({ pattern, items: map.get(pattern)! }));
}

function htmlToText(html: string): string {
  return html
    .replace(/<h4>(.*?)<\/h4>/g, "\n\n**$1**\n\n")
    .replace(/<pre>([\s\S]*?)<\/pre>/g, (_m, c) => "\n```\n" + c.trim() + "\n```\n")
    .replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "").trim();
}

export function formatProblemMarkdown(p: Problem): string {
  const diff = p.diff.charAt(0).toUpperCase() + p.diff.slice(1);
  return `# #${p.num} ${p.title}\n\n**${diff} · ${p.pattern}**\n\n${htmlToText(p.descHtml)}\n\n[Reference · LeetCode #${p.num}](${p.url})\n`;
}
```

Copy **all** `STARTERS` entries and **all** `PROBLEMS`/`P(...)` rows from `mock-interview-room.html` — do not abbreviate the real file; the `// ...` above marks where the full ported data goes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: PASS (all `problems.test.ts` tests).

- [ ] **Step 5: Commit**

```bash
git add extension/src/problems.ts extension/test/problems.test.ts
git commit -m "feat(ext): port problem bank with grouping + markdown"
```

---

### Task 3: Prompt builders (`prompt.ts`)

**Files:**
- Create: `extension/src/prompt.ts`
- Test: `extension/test/prompt.test.ts`

**Interfaces:**
- Consumes: `Problem` from `problems.ts`.
- Produces:
  - `interface Persona { name: string; pronoun: "he" | "she" | "they"; }`
  - `function systemPrompt(persona: Persona, problem: Problem): string`
  - `function codeContext(javaSource: string): string`
  - `const GREETING_HINT: string`, `const HINT_INSTRUCTION: string`, `const FEEDBACK_INSTRUCTION: string`

- [ ] **Step 1: Write the failing test**

```ts
// extension/test/prompt.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { systemPrompt, codeContext, HINT_INSTRUCTION } from "../src/prompt.ts";
import { getProblem } from "../src/problems.ts";

const persona = { name: "Sam", pronoun: "they" as const };

test("system prompt names the interviewer and the problem", () => {
  const sp = systemPrompt(persona, getProblem("two-sum")!);
  assert.match(sp, /Sam/);
  assert.match(sp, /Two Sum/);
  assert.match(sp, /interviewer/i);
});

test("system prompt forbids handing over the full solution", () => {
  const sp = systemPrompt(persona, getProblem("two-sum")!);
  assert.match(sp, /not.*(full|complete) (solution|answer)/i);
});

test("code context embeds the candidate's source", () => {
  const ctx = codeContext("class Solution { int x; }");
  assert.match(ctx, /class Solution \{ int x; \}/);
});

test("hint instruction asks for the smallest nudge", () => {
  assert.match(HINT_INSTRUCTION, /smallest|nudge|hint/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL — cannot find `../src/prompt.ts`.

- [ ] **Step 3: Implement `extension/src/prompt.ts`**

Port the persona/behavior wording from `mock-interview-room.html`'s `systemPrompt()` (search for `systemPrompt`), adapting to take the persona and problem as parameters.

```ts
import type { Problem } from "./problems.ts";

export interface Persona { name: string; pronoun: "he" | "she" | "they"; }

function selfRef(pronoun: Persona["pronoun"]): string {
  return pronoun === "he" ? "he/him" : pronoun === "she" ? "she/her" : "they/them";
}

export function systemPrompt(persona: Persona, problem: Problem): string {
  const desc = problem.descHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return [
    `You are ${persona.name} (${selfRef(persona.pronoun)}), a calm, warm, professional technical interviewer conducting a live coding interview.`,
    `Speak naturally and concisely, as if talking out loud. Ask one thing at a time.`,
    `The problem under discussion is "${problem.title}" (${problem.diff}, pattern: ${problem.pattern}): ${desc}`,
    `Coach by asking guiding questions and reacting to the candidate's reasoning and code. Do NOT reveal the full solution or write complete code for them; nudge instead.`,
    `Keep spoken turns short. When the candidate shares code, react to what they actually wrote.`,
  ].join("\n\n");
}

export function codeContext(javaSource: string): string {
  return `Here is my current editor code (Solution.java):\n\n\`\`\`java\n${javaSource}\n\`\`\``;
}

export const GREETING_HINT =
  "Greet the candidate by (your) name, briefly state the problem in your own words, and invite clarifying questions. Keep it to a few sentences.";

export const HINT_INSTRUCTION =
  "Give the smallest useful hint — a single nudge toward the next step. Never reveal the full solution.";

export const FEEDBACK_INSTRUCTION =
  "The interview is ending. Give a short, honest assessment: what was strong, and one or two concrete things to work on. Two short paragraphs at most.";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/prompt.ts extension/test/prompt.test.ts
git commit -m "feat(ext): interview prompt builders"
```

---

### Task 4: OpenAI client (`openai.ts`)

**Files:**
- Create: `extension/src/openai.ts`
- Test: `extension/test/openai.test.ts`

**Interfaces:**
- Produces:
  - `type Msg = { role: "system" | "user" | "assistant"; content: string }`
  - `type FetchImpl = typeof fetch`
  - `async function chatCompletion(key: string, model: string, messages: Msg[], signal?: AbortSignal, fetchImpl?: FetchImpl): Promise<string>`
  - `async function transcribe(key: string, model: string, audio: Uint8Array, mime: string, signal?: AbortSignal, fetchImpl?: FetchImpl): Promise<string>`
  - `async function synthesizeSpeech(key: string, model: string, voice: string, text: string, speed: number, signal?: AbortSignal, fetchImpl?: FetchImpl): Promise<Uint8Array>`
- Constant base URL `https://api.openai.com` (no proxy).

- [ ] **Step 1: Write the failing test**

```ts
// extension/test/openai.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatCompletion, synthesizeSpeech } from "../src/openai.ts";

function mockFetch(capture: any, response: any): typeof fetch {
  return (async (url: any, init: any) => {
    capture.url = String(url); capture.init = init;
    capture.body = init?.body ? JSON.parse(init.body) : undefined;
    return response;
  }) as unknown as typeof fetch;
}

test("chatCompletion posts GPT-5 params and returns content", async () => {
  const cap: any = {};
  const res = {
    ok: true,
    json: async () => ({ choices: [{ message: { content: "Hello there." } }] }),
  };
  const out = await chatCompletion("sk-x", "gpt-5.6",
    [{ role: "user", content: "hi" }], undefined, mockFetch(cap, res));
  assert.equal(out, "Hello there.");
  assert.equal(cap.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(cap.init.headers.Authorization, "Bearer sk-x");
  assert.equal(cap.body.model, "gpt-5.6");
  assert.equal(cap.body.max_completion_tokens, 2000);
  assert.equal(cap.body.reasoning_effort, "low");
  assert.ok(!("temperature" in cap.body), "must not send temperature");
  assert.ok(!("max_tokens" in cap.body), "must not send max_tokens");
});

test("chatCompletion throws the API error message", async () => {
  const res = { ok: false, status: 401, json: async () => ({ error: { message: "bad key" } }) };
  await assert.rejects(
    () => chatCompletion("sk-x", "gpt-5.6", [{ role: "user", content: "hi" }], undefined, mockFetch({} as any, res)),
    /bad key/
  );
});

test("synthesizeSpeech returns audio bytes", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const res = { ok: true, arrayBuffer: async () => bytes.buffer };
  const out = await synthesizeSpeech("sk-x", "gpt-4o-mini-tts", "onyx", "hi", 1, undefined, mockFetch({} as any, res));
  assert.deepEqual(Array.from(out), [1, 2, 3]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL — cannot find `../src/openai.ts`.

- [ ] **Step 3: Implement `extension/src/openai.ts`**

```ts
const BASE = "https://api.openai.com";
export type Msg = { role: "system" | "user" | "assistant"; content: string };
export type FetchImpl = typeof fetch;

async function apiError(res: Response, fallback: string): Promise<Error> {
  let msg = fallback;
  try { const j: any = await res.json(); msg = j?.error?.message || fallback; } catch { /* ignore */ }
  return new Error(msg);
}

export async function chatCompletion(
  key: string, model: string, messages: Msg[],
  signal?: AbortSignal, fetchImpl: FetchImpl = fetch
): Promise<string> {
  const res = await fetchImpl(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, max_completion_tokens: 2000, reasoning_effort: "low" }),
    signal,
  });
  if (!res.ok) throw await apiError(res, `HTTP ${res.status}`);
  const data: any = await res.json();
  return (data?.choices?.[0]?.message?.content || "").trim();
}

export async function transcribe(
  key: string, model: string, audio: Uint8Array, mime: string,
  signal?: AbortSignal, fetchImpl: FetchImpl = fetch
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mime }), "audio.webm");
  form.append("model", model);
  form.append("response_format", "json");
  const res = await fetchImpl(`${BASE}/v1/audio/transcriptions`, {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal,
  });
  if (!res.ok) throw await apiError(res, `HTTP ${res.status}`);
  const data: any = await res.json();
  return (data?.text || "").trim();
}

export async function synthesizeSpeech(
  key: string, model: string, voice: string, text: string, speed: number,
  signal?: AbortSignal, fetchImpl: FetchImpl = fetch
): Promise<Uint8Array> {
  const body: any = { model, voice, input: text, response_format: "mp3", speed };
  if (model === "gpt-4o-mini-tts") {
    body.instructions =
      "You are a calm, warm, professional technical interviewer. Speak naturally, at a measured, unhurried pace.";
  }
  const res = await fetchImpl(`${BASE}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body), signal,
  });
  if (!res.ok) throw await apiError(res, `HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/openai.ts extension/test/openai.test.ts
git commit -m "feat(ext): host-side OpenAI client (chat/transcribe/TTS)"
```

---

### Task 5: Settings + secret store (`store.ts`)

**Files:**
- Create: `extension/src/store.ts`
- Test: `extension/test/store.test.ts`

**Interfaces:**
- Produces:
  - `interface Settings { model: string; transcribeModel: string; ttsModel: string; voice: string; voiceMode: "neural" | "browser"; speechRate: number; interviewerName: string; interviewerPronoun: "he" | "she" | "they"; }`
  - `const DEFAULT_SETTINGS: Settings`
  - `interface SecretsLike { get(k: string): Thenable<string | undefined>; store(k: string, v: string): Thenable<void>; delete(k: string): Thenable<void>; }`
  - `interface MementoLike { get<T>(k: string): T | undefined; update(k: string, v: unknown): Thenable<void>; }`
  - `function getSettings(m: MementoLike): Settings`
  - `async function setSettings(m: MementoLike, patch: Partial<Settings>): Promise<Settings>`
  - `async function getKey(s: SecretsLike): Promise<string>`
  - `async function setKey(s: SecretsLike, key: string): Promise<void>`
  - `const KEY_ID = "onsite.openaiKey"`, `const SETTINGS_ID = "onsite.settings"`

- [ ] **Step 1: Write the failing test**

```ts
// extension/test/store.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, getSettings, setSettings, getKey, setKey } from "../src/store.ts";

function fakeMemento() {
  const data = new Map<string, unknown>();
  return { get: <T>(k: string) => data.get(k) as T | undefined, update: async (k: string, v: unknown) => void data.set(k, v) };
}
function fakeSecrets() {
  const data = new Map<string, string>();
  return { get: async (k: string) => data.get(k), store: async (k: string, v: string) => void data.set(k, v), delete: async (k: string) => void data.delete(k) };
}

test("defaults are returned when nothing stored", () => {
  assert.deepEqual(getSettings(fakeMemento()), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.model, "gpt-5.6");
  assert.equal(DEFAULT_SETTINGS.voiceMode, "neural");
});

test("setSettings merges a patch over defaults and persists", async () => {
  const m = fakeMemento();
  const s = await setSettings(m, { voice: "nova", speechRate: 1.5 });
  assert.equal(s.voice, "nova");
  assert.equal(s.speechRate, 1.5);
  assert.equal(getSettings(m).voice, "nova");
  assert.equal(getSettings(m).model, "gpt-5.6");
});

test("key round-trips through secrets", async () => {
  const s = fakeSecrets();
  assert.equal(await getKey(s), "");
  await setKey(s, "sk-abc");
  assert.equal(await getKey(s), "sk-abc");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL — cannot find `../src/store.ts`.

- [ ] **Step 3: Implement `extension/src/store.ts`**

```ts
export interface Settings {
  model: string; transcribeModel: string; ttsModel: string;
  voice: string; voiceMode: "neural" | "browser"; speechRate: number;
  interviewerName: string; interviewerPronoun: "he" | "she" | "they";
}

export const DEFAULT_SETTINGS: Settings = {
  model: "gpt-5.6", transcribeModel: "gpt-4o-transcribe", ttsModel: "gpt-4o-mini-tts",
  voice: "onyx", voiceMode: "neural", speechRate: 1,
  interviewerName: "Sam", interviewerPronoun: "they",
};

export const KEY_ID = "onsite.openaiKey";
export const SETTINGS_ID = "onsite.settings";

export interface SecretsLike {
  get(k: string): Thenable<string | undefined>;
  store(k: string, v: string): Thenable<void>;
  delete(k: string): Thenable<void>;
}
export interface MementoLike {
  get<T>(k: string): T | undefined;
  update(k: string, v: unknown): Thenable<void>;
}

export function getSettings(m: MementoLike): Settings {
  return { ...DEFAULT_SETTINGS, ...(m.get<Partial<Settings>>(SETTINGS_ID) || {}) };
}
export async function setSettings(m: MementoLike, patch: Partial<Settings>): Promise<Settings> {
  const next = { ...getSettings(m), ...patch };
  await m.update(SETTINGS_ID, next);
  return next;
}
export async function getKey(s: SecretsLike): Promise<string> {
  return (await s.get(KEY_ID)) || "";
}
export async function setKey(s: SecretsLike, key: string): Promise<void> {
  if (key) await s.store(KEY_ID, key); else await s.delete(KEY_ID);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/store.ts extension/test/store.test.ts
git commit -m "feat(ext): settings (globalState) + key (SecretStorage) store"
```

---

### Task 6: Adaptive endpointing module (`media/endpointing.js`)

**Files:**
- Create: `extension/src/media/endpointing.js`
- Test: `extension/test/endpointing.test.ts`

**Interfaces:**
- Produces (ES module):
  - `export const MIN_PAUSE_MS = 800, MAX_PAUSE_MS = 5000, DEFAULT_PAUSE_MS = 2500, PAUSE_MARGIN_MS = 700, MIN_SAMPLE_MS = 300, MAX_PAUSE_SAMPLES = 20;`
  - `export function makeEndpointer()` returning `{ reset(), onResumedPause(ms), current() }` where `current()` is the adaptive threshold.

- [ ] **Step 1: Write the failing test**

```ts
// extension/test/endpointing.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEndpointer } from "../src/media/endpointing.js";

test("defaults to 2500ms with no samples", () => {
  assert.equal(makeEndpointer().current(), 2500);
});

test("fast talker shrinks toward min; clamps at 800", () => {
  const e = makeEndpointer();
  for (let i = 0; i < 10; i++) e.onResumedPause(400);
  assert.equal(e.current(), 1100); // 400 + 700
  e.reset();
  for (let i = 0; i < 10; i++) e.onResumedPause(50);
  assert.equal(e.current(), 800); // 50+700 -> clamped
});

test("thoughtful talker grows; clamps at 5000", () => {
  const e = makeEndpointer();
  for (let i = 0; i < 10; i++) e.onResumedPause(4500);
  assert.equal(e.current(), 5000); // 5200 -> clamped
});

test("tiny gaps under MIN_SAMPLE_MS are ignored", () => {
  const e = makeEndpointer();
  e.onResumedPause(200);
  assert.equal(e.current(), 2500);
});

test("rolling window keeps only the last 20 samples", () => {
  const e = makeEndpointer();
  for (let i = 0; i < 25; i++) e.onResumedPause(400);
  assert.equal(e.current(), 1100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL — cannot find `../src/media/endpointing.js`.

- [ ] **Step 3: Implement `extension/src/media/endpointing.js`**

```js
export const MIN_PAUSE_MS = 800, MAX_PAUSE_MS = 5000, DEFAULT_PAUSE_MS = 2500;
export const PAUSE_MARGIN_MS = 700, MIN_SAMPLE_MS = 300, MAX_PAUSE_SAMPLES = 20;

export function makeEndpointer() {
  let samples = [];
  let value = DEFAULT_PAUSE_MS;
  function recompute() {
    if (!samples.length) { value = DEFAULT_PAUSE_MS; return; }
    const sorted = [...samples].sort((a, b) => a - b);
    const p90 = sorted[Math.min(sorted.length - 1, Math.floor(0.9 * sorted.length))];
    value = Math.max(MIN_PAUSE_MS, Math.min(MAX_PAUSE_MS, p90 + PAUSE_MARGIN_MS));
  }
  return {
    reset() { samples = []; value = DEFAULT_PAUSE_MS; },
    onResumedPause(ms) {
      if (ms < MIN_SAMPLE_MS) return;
      samples.push(ms);
      if (samples.length > MAX_PAUSE_SAMPLES) samples.shift();
      recompute();
    },
    current() { return value; },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/media/endpointing.js extension/test/endpointing.test.ts
git commit -m "feat(ext): adaptive endpointing module (shared, tested)"
```

---

### Task 7: Problem documents (`problemDoc.ts`)

**Files:**
- Create: `extension/src/problemDoc.ts`

**Interfaces:**
- Consumes: `Problem`, `formatProblemMarkdown` from `problems.ts`.
- Produces:
  - `async function openProblemDocs(problem: Problem): Promise<vscode.TextDocument>` — opens the untitled `Solution.java` in column 1 (returned) and the problem markdown preview in column 2.
  - `function readSolution(doc: vscode.TextDocument): string`
- Uses a `TextDocumentContentProvider` registered on scheme `onsite-problem` for the read-only markdown; register it in `activate` (Task 9) via `registerProblemScheme(context)`.

- [ ] **Step 1: Implement `extension/src/problemDoc.ts`** (glue code; verified by compile + manual F5)

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd extension && npm run compile`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/problemDoc.ts
git commit -m "feat(ext): open Solution.java + problem preview"
```

---

### Task 8: Sam panel webview (`panel.ts` + media)

**Files:**
- Create: `extension/src/media/panel.html`
- Create: `extension/src/media/panel.css`
- Create: `extension/src/media/panel.js`
- Create: `extension/src/panel.ts`

**Interfaces:**
- Produces:
  - `class SamViewProvider implements vscode.WebviewViewProvider` with `resolveWebviewView(...)`, a public `post(msg: HostToPanel)` method, and an `onMessage(cb: (m: PanelToHost) => void)` hook.
  - Message types (shared contract, documented at top of `panel.ts`):
    - `PanelToHost = { type: "ready" } | { type: "startInterview"; problemId: string } | { type: "userText"; text: string } | { type: "audioCaptured"; bytes: number[]; mime: string } | { type: "hint" } | { type: "shareCode" } | { type: "endInterview" } | { type: "openSettings" }`
    - `HostToPanel = { type: "settings"; settings: Settings } | { type: "problems"; groups: {pattern:string; items:{id:string;num:number;title:string;diff:string}[]}[] } | { type: "interviewStarted"; title: string; name: string } | { type: "presence"; state: string; label: string } | { type: "userBubble"; text: string } | { type: "samBubble"; text: string } | { type: "tts"; bytes: number[] } | { type: "speakBrowser"; text: string; rate: number } | { type: "banner"; html: string; kind: string } | { type: "home" }`

- [ ] **Step 1: Create `extension/src/media/panel.html`**

Use placeholders `{{cspSource}}`, `{{nonce}}`, `{{panelCss}}`, `{{panelJs}}`, `{{endpointingJs}}` substituted by `panel.ts`. Port the visual structure of the `.dock` region from `mock-interview-room.html` (status orb, transcript, talkbar) plus a **home** section (problem `<select>` grouped by pattern, **Start interview** and **⚙ Settings** buttons).

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; img-src {{cspSource}} data:; media-src {{cspSource}} blob: data:; style-src {{cspSource}} 'unsafe-inline'; script-src 'nonce-{{nonce}}'; connect-src 'none';">
<style>{{panelCss}}</style>
</head>
<body>
  <section id="home">
    <select id="problemSelect" aria-label="Choose a problem"></select>
    <button id="startBtn">Start interview</button>
    <button id="settingsBtn">⚙ Settings</button>
  </section>
  <section id="interview" hidden>
    <header class="dock-head">
      <div class="orb" id="orb"></div>
      <div class="who"><b id="nameLabel">Sam</b><small>your interviewer</small></div>
      <div class="status" id="status">idle</div>
      <button id="settingsBtn2" title="Settings">⚙</button>
    </header>
    <div class="banner" id="banner" hidden></div>
    <div class="transcript" id="transcript"></div>
    <div class="talkbar">
      <button id="mic" title="Talk">🎤</button>
      <input id="textInput" placeholder="Talk out loud — or type here">
      <button id="sendBtn">Send</button>
      <button id="shareBtn">Share code</button>
      <button id="hintBtn">Hint</button>
      <button id="endBtn">End &amp; feedback</button>
      <button id="muteBtn" title="Mute">🔊</button>
    </div>
  </section>
  <script nonce="{{nonce}}" type="module">{{endpointingJs}}
{{panelJs}}</script>
</body>
</html>
```

- [ ] **Step 2: Create `extension/src/media/panel.css`**

Port the relevant styles for `.dock-head`, `.transcript`, `.msg`, `.talkbar`, `.orb`, `.banner`, and basic button/select styling from `mock-interview-room.html`. Use VS Code theme variables so it fits the editor theme:

```css
body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground);
  background: var(--vscode-panel-background); font-size: 13px; }
#home { display: flex; gap: 8px; align-items: center; padding: 10px; flex-wrap: wrap; }
select, input, button { font: inherit; color: var(--vscode-foreground);
  background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 6px; padding: 6px 8px; }
button { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  border: none; cursor: pointer; }
button.secondary { background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground); }
#interview { display: flex; flex-direction: column; height: 100vh; }
.dock-head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; }
.orb { width: 20px; height: 20px; border-radius: 50%; background: var(--vscode-charts-orange, orange); }
.status { margin-left: auto; opacity: .7; }
.transcript { flex: 1; overflow: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 80%; padding: 8px 11px; border-radius: 10px;
  background: var(--vscode-editorWidget-background); }
.msg.you { align-self: flex-end; background: var(--vscode-button-background);
  color: var(--vscode-button-foreground); }
.msg.system { align-self: center; opacity: .7; font-size: 12px; }
.banner { margin: 6px 12px; padding: 8px 10px; border-radius: 6px;
  background: var(--vscode-inputValidation-warningBackground);
  border: 1px solid var(--vscode-inputValidation-warningBorder); }
.talkbar { display: flex; gap: 6px; align-items: center; padding: 8px 12px;
  border-top: 1px solid var(--vscode-panel-border); }
.talkbar input { flex: 1; }
#mic.rec { background: var(--vscode-charts-red, red); color: #fff; }
```

- [ ] **Step 3: Create `extension/src/media/panel.js`**

Port the webview logic from `mock-interview-room.html`, **replacing every OpenAI `fetch` with the message bridge**. Key adaptations: the VAD loop uses `makeEndpointer()` from `endpointing.js`; on end-of-turn it posts `audioCaptured` (recorder bytes) instead of transcribing; typed sends post `userText`; audio playback comes from the host's `tts` message; browser fallback uses `speechSynthesis` on `speakBrowser`.

```js
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const endpointer = makeEndpointer(); // from endpointing.js (inlined above this script)

let settings = null, muted = false, handsFree = false, listening = false;
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
$("startBtn").onclick = () => vscode.postMessage({ type: "startInterview", problemId: $("problemSelect").value });
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
  audioEl.onended = () => { URL.revokeObjectURL(url); onSpeechEnd(); };
  audioEl.play().catch(() => onSpeechEnd());
}
function speakBrowser(text, rate) {
  if (!("speechSynthesis" in window)) { onSpeechEnd(); return; }
  stopAudio();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate || 1; u.onend = onSpeechEnd;
  speechSynthesis.speak(u);
}
function onSpeechEnd() { if (handsFree && !listening) setTimeout(startListening, 300); }

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
    $("banner").hidden = false; $("banner").textContent = "Mic blocked — type instead.";
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
    case "home": $("interview").hidden = true; $("home").hidden = false; handsFree = false; stopListening(); stopAudio(); break;
  }
});
vscode.postMessage({ type: "ready" });
```

- [ ] **Step 4: Implement `extension/src/panel.ts`** (host side: HTML assembly + provider)

```ts
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
  | { type: "interviewStarted"; title: string; name: string }
  | { type: "presence"; state: string; label: string }
  | { type: "userBubble"; text: string } | { type: "samBubble"; text: string }
  | { type: "tts"; bytes: number[] } | { type: "speakBrowser"; text: string; rate: number }
  | { type: "banner"; html: string; kind: string } | { type: "home" };

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
```

(Note: `endpointing.js` `export`s are stripped when inlined into the webview so its symbols are in scope for `panel.js`; the test still imports the ES-module version.)

- [ ] **Step 5: Verify it compiles**

Run: `cd extension && npm run compile`
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add extension/src/panel.ts extension/src/media/panel.html extension/src/media/panel.css extension/src/media/panel.js
git commit -m "feat(ext): Sam bottom-panel webview + bridge"
```

---

### Task 9: Settings page webview (`settingsPage.ts` + media)

**Files:**
- Create: `extension/src/media/settings.html`
- Create: `extension/src/media/settings.css`
- Create: `extension/src/media/settings.js`
- Create: `extension/src/settingsPage.ts`

**Interfaces:**
- Produces:
  - `function openSettingsPage(ctx, current: Settings, keyIsSet: boolean, handlers: { save(patch: Partial<Settings>, key?: string): Promise<void>; testVoice(s: Settings, key: string): Promise<void> })`
  - Messages: page→host `{ type:"save"; settings: Partial<Settings>; key?: string }`, `{ type:"testVoice"; settings: Settings }`, `{ type:"ready" }`; host→page `{ type:"init"; settings: Settings; keyIsSet: boolean }`, `{ type:"saved" }`.

- [ ] **Step 1: Create `extension/src/media/settings.html`**

Same CSP/nonce placeholder pattern as `panel.html`. Fields mirror the web app's settings modal: API key (password), bot model, transcription model, voice mode (neural/browser), OpenAI voice, TTS model, speech rate, interviewer name, pronoun; **Save** and **Test voice** buttons.

```html
<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src {{cspSource}} 'unsafe-inline'; script-src 'nonce-{{nonce}}';">
<style>{{settingsCss}}</style></head>
<body>
  <h2>Onsite settings</h2>
  <label>OpenAI API key <input id="apiKey" type="password" placeholder="sk-…"></label>
  <p class="note" id="keyNote"></p>
  <label>Interviewer model <select id="model"></select></label>
  <label>Transcription model <select id="transcribeModel"></select></label>
  <label>Voice mode <select id="voiceMode"><option value="neural">Neural · OpenAI</option><option value="browser">Browser voice</option></select></label>
  <label>Voice <select id="voice"></select></label>
  <label>TTS model <select id="ttsModel"></select></label>
  <label>Speech speed <select id="speechRate"><option>0.5</option><option>1</option><option>1.5</option><option>2</option><option>2.5</option></select></label>
  <label>Interviewer name <input id="interviewerName" maxlength="30"></label>
  <label>Pronoun <select id="interviewerPronoun"><option value="they">They/Them</option><option value="she">She/Her</option><option value="he">He/Him</option></select></label>
  <div class="row"><button id="save">Save</button><button id="test" class="secondary">Test voice</button></div>
  <script nonce="{{nonce}}">{{settingsJs}}</script>
</body></html>
```

- [ ] **Step 2: Create `extension/src/media/settings.css`**

```css
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
  background: var(--vscode-editor-background); padding: 18px 22px; max-width: 560px; }
label { display: block; margin: 12px 0; }
input, select { display: block; margin-top: 4px; width: 100%; box-sizing: border-box;
  background: var(--vscode-input-background); color: var(--vscode-foreground);
  border: 1px solid var(--vscode-input-border, transparent); border-radius: 6px; padding: 7px 9px; }
.note { color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: -6px; }
.row { display: flex; gap: 8px; margin-top: 18px; }
button { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  border: none; border-radius: 6px; padding: 8px 14px; cursor: pointer; }
button.secondary { background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground); }
```

- [ ] **Step 3: Create `extension/src/media/settings.js`**

```js
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
```

- [ ] **Step 4: Implement `extension/src/settingsPage.ts`**

```ts
import * as vscode from "vscode";
import * as fs from "fs";
import type { Settings } from "./store.ts";

function nonce(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
function read(ctx: vscode.ExtensionContext, p: string): string {
  return fs.readFileSync(vscode.Uri.joinPath(ctx.extensionUri, "src", "media", p).fsPath, "utf8");
}

export interface SettingsHandlers {
  save(patch: Partial<Settings>, key?: string): Promise<void>;
  testVoice(s: Settings): Promise<void>;
}

let panel: vscode.WebviewPanel | undefined;

export function openSettingsPage(
  ctx: vscode.ExtensionContext, current: Settings, keyIsSet: boolean, handlers: SettingsHandlers
): void {
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
    else if (m.type === "save") { await handlers.save(m.settings, m.key); vscode.window.showInformationMessage("Onsite settings saved."); }
    else if (m.type === "testVoice") { await handlers.testVoice({ ...current, ...m.settings }); }
  });
  panel.onDidDispose(() => { panel = undefined; });
}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd extension && npm run compile`
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add extension/src/settingsPage.ts extension/src/media/settings.html extension/src/media/settings.css extension/src/media/settings.js
git commit -m "feat(ext): dedicated settings page webview"
```

---

### Task 10: Interview orchestration (`interview.ts`)

**Files:**
- Create: `extension/src/interview.ts`
- Test: `extension/test/interview.test.ts`

**Interfaces:**
- Consumes: `chatCompletion`, `Msg` (openai.ts); `systemPrompt`, `codeContext`, `GREETING_HINT`, `HINT_INSTRUCTION`, `FEEDBACK_INSTRUCTION` (prompt.ts); `Problem` (problems.ts); `Persona` (prompt.ts).
- Produces:
  - `class InterviewSession` with:
    - `constructor(persona: Persona, problem: Problem)`
    - `messages(): Msg[]` (system + running conversation)
    - `pushUser(text: string): void`, `pushAssistant(text: string): void`
    - `turnMessages(userText: string, javaSource: string): Msg[]` — appends the user turn (with code context) and returns the full message list to send (does not mutate until `pushAssistant`), following the web app's "resend full history + current code each turn" behavior.
  - This class is **pure** (no `vscode`, no network) so it is unit-tested; `extension.ts` calls `chatCompletion(key, model, session.turnMessages(...))`.

- [ ] **Step 1: Write the failing test**

```ts
// extension/test/interview.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { InterviewSession } from "../src/interview.ts";
import { getProblem } from "../src/problems.ts";

const persona = { name: "Sam", pronoun: "they" as const };

test("first message is the system prompt naming the problem", () => {
  const s = new InterviewSession(persona, getProblem("two-sum")!);
  const msgs = s.messages();
  assert.equal(msgs[0].role, "system");
  assert.match(msgs[0].content, /Two Sum/);
});

test("turnMessages includes the user text and the current code, without persisting until pushAssistant", () => {
  const s = new InterviewSession(persona, getProblem("two-sum")!);
  const out = s.turnMessages("here is my idea", "class Solution { int a; }");
  const last = out[out.length - 1];
  assert.equal(last.role, "user");
  assert.match(last.content, /here is my idea/);
  assert.match(last.content, /class Solution \{ int a; \}/);
  // not persisted yet
  assert.equal(s.messages().filter((m) => m.role === "user").length, 0);
  s.pushUser("here is my idea"); s.pushAssistant("ok");
  assert.equal(s.messages().filter((m) => m.role === "assistant").length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL — cannot find `../src/interview.ts`.

- [ ] **Step 3: Implement `extension/src/interview.ts`**

```ts
import type { Msg } from "./openai.ts";
import type { Problem } from "./problems.ts";
import type { Persona } from "./prompt.ts";
import { systemPrompt, codeContext } from "./prompt.ts";

export class InterviewSession {
  private history: Msg[] = [];
  private readonly system: Msg;
  constructor(persona: Persona, public readonly problem: Problem) {
    this.system = { role: "system", content: systemPrompt(persona, problem) };
  }
  messages(): Msg[] { return [this.system, ...this.history]; }
  pushUser(text: string): void { this.history.push({ role: "user", content: text }); }
  pushAssistant(text: string): void { this.history.push({ role: "assistant", content: text }); }
  // Build the messages to send this turn: full history + a fresh user turn carrying code.
  turnMessages(userText: string, javaSource: string): Msg[] {
    const content = `${userText}\n\n${codeContext(javaSource)}`;
    return [...this.messages(), { role: "user", content }];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/interview.ts extension/test/interview.test.ts
git commit -m "feat(ext): interview session state + turn assembly"
```

---

### Task 11: Wire everything in `extension.ts`

**Files:**
- Modify: `extension/src/extension.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the fully wired extension (status bar, panel provider, settings page, interview loop).

- [ ] **Step 1: Replace `extension/src/extension.ts` with the full wiring**

```ts
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
  let abort: AbortController | undefined;

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

  function showSettings() {
    getKey(context.secrets).then((k) =>
      openSettingsPage(context, settings(), !!k, {
        save: async (patch, key) => { await setSettings(context.globalState, patch); if (key !== undefined) await setKey(context.secrets, key); sendSettings(); },
        testVoice: async (s) => { await speak("Hi, I'm " + s.interviewerName + ". Let's begin when you're ready.", s); },
      })
    );
  }

  async function speak(text: string, s: Settings): Promise<void> {
    if (s.voiceMode === "browser") { provider.post({ type: "speakBrowser", text, rate: s.speechRate }); return; }
    const key = await getKey(context.secrets);
    if (!key) return;
    try {
      const bytes = await synthesizeSpeech(key, s.ttsModel, s.voice, text, s.speechRate, abort?.signal);
      provider.post({ type: "tts", bytes: Array.from(bytes) });
    } catch { provider.post({ type: "speakBrowser", text, rate: s.speechRate }); }
  }

  async function runAssistantTurn(sendMessages: Parameters<typeof chatCompletion>[2]): Promise<void> {
    const key = await requireKey(); if (!key) return;
    const s = settings();
    provider.post({ type: "presence", state: "thinking", label: "thinking…" });
    abort = new AbortController();
    try {
      const reply = await chatCompletion(key, s.model, sendMessages, abort.signal);
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
        const p = getProblem(m.problemId); if (!p) return;
        if (!(await requireKey())) return;
        solutionDoc = await openProblemDocs(p);
        session = new InterviewSession(persona(), p);
        provider.reveal();
        provider.post({ type: "interviewStarted", title: p.title, name: settings().interviewerName });
        // greeting
        await runAssistantTurn([...session.messages(), { role: "user", content: GREETING_HINT }]);
        break;
      }
      case "userText": await userTurn(m.text); break;
      case "audioCaptured": {
        const key = await requireKey(); if (!key || !session) return;
        provider.post({ type: "presence", state: "thinking", label: "transcribing…" });
        try {
          const text = await transcribe(key, settings().transcribeModel, new Uint8Array(m.bytes), m.mime);
          if (text) await userTurn(text);
          else provider.post({ type: "presence", state: "idle", label: "listening for you" });
        } catch (e: any) {
          provider.post({ type: "banner", kind: "err", html: "Transcription failed: " + (e?.message || e) });
        }
        break;
      }
      case "hint": if (session) await runAssistantTurn([...session.messages(), { role: "user", content: HINT_INSTRUCTION }]); break;
      case "shareCode": if (session && solutionDoc) await userTurn("Here's my current code — what do you think?"); break;
      case "endInterview":
        if (session) await runAssistantTurn([...session.messages(), { role: "user", content: FEEDBACK_INSTRUCTION }]);
        abort?.abort(); session = undefined; solutionDoc = undefined;
        provider.post({ type: "home" });
        break;
    }
  });
}

export function deactivate(): void {}
```

- [ ] **Step 2: Verify full compile**

Run: `cd extension && npm run compile`
Expected: no TypeScript errors.

- [ ] **Step 3: Run the full unit suite**

Run: `cd extension && npm test`
Expected: all tests PASS (problems, prompt, openai, store, endpointing, interview).

- [ ] **Step 4: Package the extension**

Run: `cd extension && npx vsce package --no-dependencies`
Expected: `onsite-interview-0.1.0.vsix` produced.

- [ ] **Step 5: Commit**

```bash
git add extension/src/extension.ts
git commit -m "feat(ext): wire panel, settings, and interview loop"
```

---

### Task 12: README + manual test guide

**Files:**
- Create: `extension/README.md`

**Interfaces:** none (docs).

- [ ] **Step 1: Write `extension/README.md`**

Cover: what it is; install the `.vsix` (Extensions → `…` → Install from VSIX); the status-bar **🟠 Onsite** button opens the panel; **⚙ Settings** to paste the key (stored in SecretStorage) and choose models/voice; pick a problem and **Start interview**; talk or type; Hint / Share code / End; note that `Solution.java` is an untitled Java doc (save into a Java project for full IntelliSense). Include the dev workflow: `npm install`, `npm run watch`, press **F5** for the Extension Development Host, and the manual test checklist below.

Manual test checklist (document verbatim):
1. F5 → Extension Development Host opens.
2. Click status-bar **🟠 Onsite** → the Interview panel appears in the bottom Panel.
3. Click **⚙ Settings** → paste a real OpenAI key → Save. Reopen Settings → the note says a key is saved.
4. Pick a problem → **Start interview** → `Solution.java` opens in column 1, the problem preview opens beside it, Sam greets you (text + voice).
5. Type a message → Sam replies in text and voice; the mic re-arms.
6. Click **🎤**, speak, pause → it transcribes, sends, Sam replies.
7. **Share code**, **Hint**, **End & feedback** each work; End returns to the home state.
8. Reload the window → settings persist; the key is still saved.

- [ ] **Step 2: Commit**

```bash
git add extension/README.md
git commit -m "docs(ext): extension README + manual test guide"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** two webviews (Tasks 8, 9), real editor + problem preview (Task 7), host OpenAI/no proxy (Task 4, 11), key in SecretStorage + settings in globalState (Task 5, 9), button-driven with status-bar entry (Tasks 1, 8, 11), voice + adaptive endpointing (Tasks 6, 8), problem bank (Task 2), `.vsix` (Tasks 1, 11), web app untouched (Global Constraints). All covered.
- **Placeholders:** the only `// ...` markers are in Task 2, explicitly instructing a verbatim port of the existing `STARTERS`/`PROBLEMS` data from `mock-interview-room.html` (a real in-repo source), not vague work.
- **Type consistency:** `Settings`, `Msg`, `Problem`, `Persona`, `PanelToHost`/`HostToPanel`, and the store signatures are used identically across tasks.
