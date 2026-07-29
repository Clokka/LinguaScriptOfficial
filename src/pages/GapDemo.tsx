// Playable prototype of the Block Blast-style gap-fill challenge, so the
// interaction can be tuned before it's wired into live playback on /watch.
// Route: /gap-demo
import { useState } from "react";
import { GapFillChallenge } from "@/components/GapFillChallenge";

const ROUNDS = [
  {
    words: ["Alors,", "quelle", "est", "la", "meilleure", "façon", "d'apprendre", "?"],
    gapIndex: 4,
    distractors: ["première", "dernière", "grande"],
    tier: "orange" as const,
    translation: "So, what is the best way to learn?",
  },
  {
    words: ["Je", "voudrais", "un", "café", "s'il", "vous", "plaît"],
    gapIndex: 3,
    distractors: ["thé", "verre", "livre"],
    tier: "red" as const,
    translation: "I would like a coffee please",
  },
];

export default function GapDemo() {
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const r = ROUNDS[round % ROUNDS.length];

  const next = () => { setDone(false); setRound((n) => n + 1); };

  return (
    <div className="min-h-screen bg-[#070d0b] px-4 py-14 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Complete the <span className="text-[#34C759]">LinguaScript</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-white/50">
          When a line is all green except one word you're learning, playback pauses.
          Drag the right block into the gap to finish it.
        </p>
      </div>

      <div className="mt-10">
        <GapFillChallenge
          key={round}
          words={r.words}
          gapIndex={r.gapIndex}
          distractors={r.distractors}
          tier={r.tier}
          translation={r.translation}
          onComplete={() => setDone(true)}
          onSkip={next}
        />
      </div>

      {done && (
        <div className="mt-8 text-center">
          <button
            onClick={next}
            className="rounded-2xl bg-[#7bbf27] px-6 py-3 font-bold text-[#04120a] transition-transform hover:scale-105"
          >
            Next line →
          </button>
        </div>
      )}
    </div>
  );
}
