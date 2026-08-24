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
