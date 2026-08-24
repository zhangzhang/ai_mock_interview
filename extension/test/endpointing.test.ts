import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEndpointer } from "../src/media/endpointing.js";

test("defaults to 2500ms with no samples", () => {
  assert.equal(makeEndpointer().current(), 2500);
});

test("fast talker shrinks toward the floor (400ms -> 1100)", () => {
  const e = makeEndpointer();
  for (let i = 0; i < 10; i++) e.onResumedPause(400);
  assert.equal(e.current(), 1100); // 400 + 700
});

test("smallest accepted sample gives the effective floor (300ms -> 1000)", () => {
  const e = makeEndpointer();
  for (let i = 0; i < 10; i++) e.onResumedPause(300); // 300 = MIN_SAMPLE_MS, accepted
  assert.equal(e.current(), 1000); // 300 + 700, above the 800 clamp
});

test("thoughtful talker grows; clamps at 5000", () => {
  const e = makeEndpointer();
  for (let i = 0; i < 10; i++) e.onResumedPause(4500);
  assert.equal(e.current(), 5000); // 5200 -> clamped
});

test("tiny gaps under MIN_SAMPLE_MS (300) are ignored", () => {
  const e = makeEndpointer();
  e.onResumedPause(200); // < 300 -> ignored
  assert.equal(e.current(), 2500);
});

test("rolling window keeps only the last 20 samples", () => {
  const e = makeEndpointer();
  for (let i = 0; i < 25; i++) e.onResumedPause(400);
  assert.equal(e.current(), 1100);
});
