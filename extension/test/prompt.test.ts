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
