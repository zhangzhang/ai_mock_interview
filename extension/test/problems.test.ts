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
