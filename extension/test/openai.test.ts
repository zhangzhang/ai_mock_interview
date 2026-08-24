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
