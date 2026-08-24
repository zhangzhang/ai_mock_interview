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
