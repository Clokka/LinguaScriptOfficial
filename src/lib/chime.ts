/**
 * The claim chime — a short mystical glass tone played when a gold word is
 * claimed into the green deck.
 *
 * Synthesised with WebAudio rather than shipping an audio file: no asset to
 * load, no first-play delay, and nothing to license. That last point is
 * deliberate — the brief was "a Zelda-ish glass jingle", and those sounds are
 * Nintendo's. This is a bell-glass tone of our own that lands in the same
 * emotional place.
 *
 * MUTED BY DEFAULT. This plays over whatever the learner is watching, and on a
 * school device an unprompted noise is worse than a missing feature. The
 * preference persists, so opting in is a one-time choice.
 */

const PREF_KEY = "linguascript.chimeEnabled";

let ctx: AudioContext | null = null;

/** Lazily created — constructing an AudioContext before a gesture is blocked. */
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function isChimeEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setChimeEnabled(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* private mode — the sound just stays off */
  }
}

/**
 * A struck-glass shimmer: a bright fundamental with two inharmonic partials
 * above it, each decaying faster than the last so the tone "sparkles" rather
 * than rings like a bell.
 *
 * No-ops silently when muted, unsupported, or under prefers-reduced-motion —
 * a learner who has asked for less motion has not asked for surprise audio.
 */
export function playClaimChime() {
  if (!isChimeEnabled()) return;
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const ac = audioContext();
  if (!ac) return;
  // Browsers suspend the context until a gesture; a claim is one.
  if (ac.state === "suspended") void ac.resume();

  const now = ac.currentTime;

  // Inharmonic ratios (not 2x/3x) are what make it read as glass rather than
  // as a musical note.
  const partials = [
    { freq: 1318.5, gain: 0.22, decay: 1.5 }, // E6 fundamental
    { freq: 1975.5, gain: 0.13, decay: 1.0 },
    { freq: 2637.0, gain: 0.07, decay: 0.6 },
  ];

  const master = ac.createGain();
  master.gain.value = 1;
  master.connect(ac.destination);

  for (const p of partials) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(p.freq, now);
    // A slight upward bend on the way in gives the "sparkle" attack.
    osc.frequency.exponentialRampToValueAtTime(p.freq * 1.01, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.gain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + p.decay + 0.05);
  }

  // Release the master node once the longest partial has died away.
  window.setTimeout(() => master.disconnect(), 1800);
}
