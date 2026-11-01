/**
 * Clean UI sound effects for learning and reviewing words.
 *
 * Synthesised with WebAudio (like chime.ts): nothing to download, nothing to
 * license, no first-play delay. Each sound is short (< 0.6 s) and quiet, with
 * soft attacks so nothing clicks or startles.
 *
 *   tap      – a tile / button press (tiny wooden tick)
 *   correct  – right answer (two-note rise, a fifth)
 *   learned  – a word turns green (bright major-chord pluck)
 *   miss     – wrong answer (soft low "bonk", never harsh)
 *   whoosh   – step transition (filtered noise sweep)
 *   levelUp  – course complete (rising arpeggio + shimmer)
 *
 * ON by default, with a mute switch remembered on this device (key ls.sfx).
 * Different from chime.ts, which plays over videos and so starts muted; these
 * only play right after the learner taps something.
 */
export type Sfx = "tap" | "correct" | "learned" | "miss" | "whoosh" | "levelUp";

const PREF_KEY = "ls.sfx";
let ctx: AudioContext | null = null;

export function sfxEnabled(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== "0"; } catch { return true; }
}

export function setSfxEnabled(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? "1" : "0"); } catch { /* private mode */ }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** One soft enveloped oscillator note. */
function note(ac: AudioContext, out: AudioNode, freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(ac: AudioContext, out: AudioNode, start: number, dur: number, vol: number, fromHz: number, toHz: number) {
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(fromHz, start);
  filter.frequency.exponentialRampToValueAtTime(toHz, start + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + dur * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(start);
  src.stop(start + dur);
}

function render(ac: AudioContext, kind: Sfx) {
  const t = ac.currentTime + 0.005;
  const out = ac.createGain();
  out.gain.value = 0.9;
  out.connect(ac.destination);
  switch (kind) {
    case "tap":
      note(ac, out, 1800, t, 0.05, 0.05, "triangle");
      break;
    case "correct":
      note(ac, out, 880, t, 0.22, 0.12);
      note(ac, out, 1318.5, t + 0.07, 0.3, 0.11);
      break;
    case "learned": // C major pluck, a little brighter than "correct"
      [1046.5, 1318.5, 1568].forEach((f, i) => note(ac, out, f, t + i * 0.035, 0.45, 0.09));
      note(ac, out, 2093, t + 0.12, 0.5, 0.04, "triangle");
      break;
    case "miss":
      note(ac, out, 220, t, 0.18, 0.12, "triangle");
      note(ac, out, 185, t + 0.06, 0.22, 0.08, "triangle");
      break;
    case "whoosh":
      noise(ac, out, t, 0.32, 0.05, 400, 3200);
      break;
    case "levelUp":
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => note(ac, out, f, t + i * 0.07, 0.5, 0.1));
      noise(ac, out, t + 0.3, 0.5, 0.025, 4000, 9000);
      break;
  }
}

export function playSfx(kind: Sfx) {
  if (!sfxEnabled()) return;
  const ac = audio();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume().then(() => render(ac, kind)).catch(() => {});
    else render(ac, kind);
  } catch { /* never break the lesson for a sound */ }
}
