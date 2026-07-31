// ChameleonWordDemo — interactive "turn the sentence green" demo, rebuilt from
// the mascot concept artifact. Tap each word to advance it new → learning →
// known; the comprehension meter fills and the chameleon's skin shifts
// red → orange → green as you go.
import { useMemo, useState } from "react";
import { ChameleonMascot, ChameleonTier } from "./ChameleonMascot";

type WordState = 0 | 1 | 2; // 0 new, 1 learning, 2 known
const WORDS = ["Alors,", "quelle", "est", "la", "meilleure", "façon", "d'apprendre", "?"];
const TRANSLATION = "So, what is the best way to learn?";
// Canonical deck colours — brand/README.md §1. Red → orange → green.
const COLORS = ["#FF3B30", "#FF8A00", "#34C759"];

export function ChameleonWordDemo() {
  const [states, setStates] = useState<WordState[]>(() => WORDS.map(() => 0));
  const [party, setParty] = useState(false);

  const advance = (i: number) => {
    setStates((prev) => {
      const next = [...prev];
      next[i] = Math.min(2, (next[i] + 1)) as WordState;
      const allKnown = next.every((s) => s === 2);
      if (allKnown) { setParty(true); setTimeout(() => setParty(false), 1800); }
      return next;
    });
  };

  const pct = useMemo(
    () => Math.round((states.reduce((a, s) => a + s, 0) / (WORDS.length * 2)) * 100),
    [states],
  );
  const tier: ChameleonTier = pct >= 100 ? "green" : pct > 0 ? "orange" : "red";
  const meterColor = COLORS[tier === "green" ? 2 : tier === "orange" ? 1 : 0];

  return (
    <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[minmax(200px,300px)_1fr]">
      {/* chameleon */}
      <div className="flex justify-center">
        <ChameleonMascot tier={tier} party={party} style={{ width: "min(300px, 70vw)" }} />
      </div>

      {/* interactive sentence */}
      <div>
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-4xl font-extrabold tabular-nums transition-colors" style={{ color: meterColor }}>{pct}%</span>
          <span className="text-xs font-bold uppercase tracking-widest text-white/45">comprehension</span>
        </div>
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: meterColor }} />
        </div>

        <div className="flex flex-wrap gap-x-2.5 gap-y-2 text-2xl font-semibold">
          {WORDS.map((w, i) => (
            <button
              key={i}
              onClick={() => advance(i)}
              className="rounded-lg px-1 py-0.5 transition-colors hover:bg-white/[0.07]"
              style={{ color: COLORS[states[i]] }}
            >
              {w}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm italic text-white/40">{TRANSLATION}</p>

        <p className="mt-5 text-[13.5px] text-white/55">
          Tap each word: <b className="font-semibold text-white/80">red</b> → orange → green.
          When the whole sentence is green, so is your chameleon. 🦎
        </p>
      </div>
    </div>
  );
}
