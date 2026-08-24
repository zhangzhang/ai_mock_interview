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
