export const MIN_PAUSE_MS = 800, MAX_PAUSE_MS = 5000, DEFAULT_PAUSE_MS = 2500;
export const PAUSE_MARGIN_MS = 700, MIN_SAMPLE_MS = 50, MAX_PAUSE_SAMPLES = 20;

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
