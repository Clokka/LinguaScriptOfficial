import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, RotateCcw } from "lucide-react";
import { DECK } from "@/lib/deck-colors";
import { ChameleonMascot } from "@/components/ChameleonMascot";

/**
 * A real, playable LinguaScript on the landing page.
 *
 * The in-app version at /linguascripts generates these from your own saved
 * words with the AI gateway. That needs an account, a deck, and a round trip,
 * none of which belong in a first impression, so this runs the identical
 * exercise shape on a fixed French set with no auth and no writes. What a
 * visitor sees here is what they get: a sentence with a hole in it, four
 * options, and the word promoting red → orange → green when they land it.
 */

interface DemoScript {
  word: string;
  translation: string;
  before: string;
  after: string;
  english: string;
  options: string[];
}

const SCRIPTS: DemoScript[] = [
  {
    word: "meilleure",
    translation: "best",
    before: "J'utiliserai la",
    after: "application d'apprentissage des langues.",
    english: "I will use the best language learning app.",
    options: ["meilleure", "première", "dernière", "prochaine"],
  },
  {
    word: "pluie",
    translation: "rain",
    before: "Elle regarde la",
    after: "tomber sur la ville.",
    english: "She watches the rain fall on the city.",
    options: ["neige", "pluie", "lumière", "foule"],
  },
  {
    word: "fenêtre",
    translation: "window",
    before: "Il lit son journal près de la",
    after: ".",
    english: "He reads his newspaper by the window.",
    options: ["porte", "cuisine", "fenêtre", "voiture"],
  },
];

type Deck = "red" | "orange" | "green";
const NEXT: Record<Deck, Deck> = { red: "orange", orange: "green", green: "green" };

const DECK_LABEL: Record<Deck, string> = {
  red: "New word",
  orange: "Learning",
  green: "Known",
};

export const LinguaScriptsDemo = ({ className = "" }: { className?: string }) => {
  const [idx, setIdx] = useState(0);
  const [decks, setDecks] = useState<Deck[]>(() => SCRIPTS.map(() => "red"));
  const [picked, setPicked] = useState<string | null>(null);

  const script = SCRIPTS[idx];
  const deck = decks[idx];
  const correct = picked === script.word;
  const greenCount = decks.filter((d) => d === "green").length;

  const shuffled = useMemo(() => script.options, [script]);

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === script.word) {
      setDecks((d) => d.map((v, i) => (i === idx ? NEXT[v] : v)));
    }
  };

  const next = () => {
    setPicked(null);
    setIdx((i) => (i + 1) % SCRIPTS.length);
  };

  const reset = () => {
    setPicked(null);
    setIdx(0);
    setDecks(SCRIPTS.map(() => "red"));
  };

  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 ${className}`}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ backgroundColor: `${DECK[deck]}1f`, color: DECK[deck] }}
          >
            {DECK_LABEL[deck]}
          </span>
          <span className="text-xs text-white/35">
            Script {idx + 1} of {SCRIPTS.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {decks.map((d, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full transition-colors"
              style={{ backgroundColor: DECK[d] }}
            />
          ))}
        </div>
      </div>

      <p className="text-2xl sm:text-3xl font-bold leading-snug">
        {script.before}{" "}
        <span
          className="inline-block min-w-[6ch] rounded-lg px-2 pb-0.5 align-baseline transition-colors"
          style={{
            backgroundColor: picked ? "transparent" : "rgba(255,255,255,0.08)",
            color: correct ? DECK.green : picked ? DECK.red : "transparent",
            borderBottom: picked ? "none" : "2px solid rgba(255,255,255,0.25)",
          }}
        >
          {picked ?? script.word}
        </span>{" "}
        {script.after}
      </p>
      <p className="mt-3 text-sm text-white/40">{script.english}</p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {shuffled.map((opt) => {
          const isAnswer = opt === script.word;
          const chosen = picked === opt;
          const show = picked !== null;
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              disabled={picked !== null}
              className="flex items-center justify-between rounded-xl border px-4 py-3 text-left text-base font-semibold transition-all disabled:cursor-default"
              style={{
                borderColor: show && isAnswer ? DECK.green : chosen ? DECK.red : "rgba(255,255,255,0.12)",
                backgroundColor: show && isAnswer ? `${DECK.green}14` : chosen ? `${DECK.red}14` : "transparent",
                color: show && isAnswer ? DECK.green : chosen ? DECK.red : "rgba(255,255,255,0.85)",
              }}
            >
              {opt}
              {show && isAnswer && <Check className="h-4 w-4" />}
              {show && chosen && !isAnswer && <X className="h-4 w-4" />}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {picked && (
          <motion.div
            key={`${idx}-${picked}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="w-14 shrink-0">
              <ChameleonMascot tier={deck} party={correct} />
            </div>
            <div className="flex-1">
              <p className="font-bold" style={{ color: correct ? DECK.green : DECK.orange }}>
                {correct
                  ? deck === "green"
                    ? `"${script.word}" is yours now.`
                    : `Nice. "${script.word}" moves up a deck.`
                  : `Close. It was "${script.word}".`}
              </p>
              <p className="text-sm text-white/45">
                {script.word} = {script.translation}. {correct ? "Two clean answers and a word goes green for good." : "No penalty here. It comes back tomorrow."}
              </p>
            </div>
            <button
              onClick={next}
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#08080B] transition-transform hover:scale-[1.03]"
            >
              Next
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 flex items-center justify-between text-xs text-white/35">
        <span>
          {greenCount} of {SCRIPTS.length} green
        </span>
        <button onClick={reset} className="flex items-center gap-1.5 hover:text-white/70">
          <RotateCcw className="h-3 w-3" /> Start over
        </button>
      </div>
    </div>
  );
};

export default LinguaScriptsDemo;
