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
  e.onResumedPause(25);
  assert.equal(e.current(), 2500);
});

test("rolling window keeps only the last 20 samples", () => {
  const e = makeEndpointer();
  for (let i = 0; i < 25; i++) e.onResumedPause(400);
  assert.equal(e.current(), 1100);
});
