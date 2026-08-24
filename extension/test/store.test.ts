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
