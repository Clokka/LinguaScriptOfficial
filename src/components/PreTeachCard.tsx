import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Volume2, Plus, Check, X } from "lucide-react";
import { gradePreTeachVocab, type PreTeachItem } from "@/lib/preTeachVocab";
import { ChameleonLoader, ChameleonMark } from "@/components/ChameleonLoader";

interface Props {
  lines: { primary: string; secondary: string }[];
  language: string;
  level: string | null;
  goal: number;
  userId?: string | null;
  onComplete: () => void;
}

const speak = (text: string, lang: string) => {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* noop */ }
};

const EXTRA = 4;
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

/**
 * Pre-teach (PPP "Present" + a quick warmer) before the video plays.
 * Shows as many key words as the learner's daily goal, with the option to add more.
 */
export const PreTeachCard = ({ lines, language, level, goal, userId, onComplete }: Props) => {
  const [pool, setPool] = useState<PreTeachItem[] | null>(null);
  const [shown, setShown] = useState(goal);
  const [stage, setStage] = useState<"present" | "warmup">("present");
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!lines.length) return;
    let alive = true;
    gradePreTeachVocab({ lines, language, level, count: goal + 12, userId })
      .then((r) => alive && setPool(r))
      .catch(() => alive && setPool([]));
    return () => { alive = false; };
  }, [lines, language, level, goal, userId]);

  useEffect(() => { setShown(goal); }, [goal]);

  // Nothing worth pre-teaching → go straight to the video.
  useEffect(() => {
    if (pool && pool.length === 0) onComplete();
  }, [pool, onComplete]);

  const items = useMemo(() => (pool ?? []).slice(0, shown), [pool, shown]);

  const question = useMemo(() => {
    const it = items[qi];
    if (!it) return null;
    const answerText = it.translation.trim();
    const distractorPool = Array.from(new Set(
      (pool ?? []).map((x) => x.translation.trim()).filter((t) => t && t.toLowerCase() !== answerText.toLowerCase()),
    ));
    const others = shuffle(distractorPool).slice(0, 2);
    return { it, options: shuffle([answerText, ...others]) };
  }, [items, qi, pool]);

  if (!pool) return <ChameleonLoader message="Finding the key words in this video…" />;

  if (stage === "warmup" && question) {
    const answer = (opt: string) => {
      if (picked) return;
      setPicked(opt);
      if (opt === question.it.translation.trim()) setScore((s) => s + 1);
      setTimeout(() => {
        setPicked(null);
        if (qi + 1 >= items.length) onComplete();
        else setQi(qi + 1);
      }, 800);
    };
    return (
      <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur overflow-y-auto">
        <div className="max-w-md mx-auto p-4 sm:p-6 flex flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Warm-up · {qi + 1} / {items.length}
          </p>
          <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(qi / items.length) * 100}%` }} />
          </div>
          <button onClick={() => speak(question.it.item, language)} className="mt-6 flex items-center gap-2">
            <span className="text-3xl font-bold text-foreground">{question.it.item}</span>
            <Volume2 className="w-5 h-5 text-muted-foreground" />
          </button>
          <p className="mt-1 text-sm text-muted-foreground">What does it mean?</p>
          <div className="mt-5 w-full space-y-2">
            {question.options.map((opt) => {
              const correct = opt === question.it.translation.trim();
              const state = picked ? (correct ? "border-emerald-500 bg-emerald-500/10" : picked === opt ? "border-destructive bg-destructive/10" : "border-border") : "border-border hover:border-primary";
              return (
                <button key={opt} onClick={() => answer(opt)} className={`w-full rounded-xl border p-3 text-left font-medium text-foreground transition-colors ${state}`}>
                  {opt}
                  {picked && correct && <Check className="inline w-4 h-4 ml-2 text-emerald-500" />}
                  {picked === opt && !correct && <X className="inline w-4 h-4 ml-2 text-destructive" />}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{score} correct so far</p>
          <button onClick={onComplete} className="mt-4 text-sm text-muted-foreground underline">Skip to the video</button>
        </div>
      </div>
    );
  }

  const canAddMore = (pool?.length ?? 0) > shown;

  return (
    <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur overflow-y-auto">
      <div className="max-w-xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <ChameleonMark size={48} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">The Chameleon Method · Before you watch</p>
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Your {items.length} words for this video</h2>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          These red words come up in the video. Listen for them and save them to turn them orange, then green.
        </p>

        <ul className="mt-4 space-y-2">
          {items.map((it, i) => (
            <motion.li
              key={it.item}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.05 }}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                <span className="font-semibold text-foreground">{it.item}</span>
                <span className="text-muted-foreground truncate">— {it.translation}</span>
                {it.isPhrase && <span className="text-[10px] rounded-full bg-accent px-2 py-0.5 text-accent-foreground">phrase</span>}
                {it.cefr && <span className="ml-auto text-[10px] uppercase rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{it.cefr}</span>}
                <button
                  onClick={() => speak(it.item, language)}
                  className={`${it.cefr ? "" : "ml-auto"} p-1.5 rounded-full hover:bg-muted text-muted-foreground`}
                  aria-label={`Hear ${it.item}`}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                “{it.example}”{it.exampleTranslation ? ` · ${it.exampleTranslation}` : ""}
                {it.occurrences > 1 ? ` · heard ${it.occurrences}×` : ""}
              </p>
            </motion.li>
          ))}
        </ul>

        {canAddMore && (
          <button
            onClick={() => setShown((n) => n + EXTRA)}
            className="mt-3 w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add {Math.min(EXTRA, (pool?.length ?? 0) - shown)} more words
          </button>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {items.length >= 3 && (
            <button onClick={() => { setQi(0); setScore(0); setStage("warmup"); }} className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
              Quick warm-up
            </button>
          )}
          <button
            onClick={onComplete}
            className={`rounded-xl py-3 font-semibold ${items.length >= 3 ? "border border-border text-foreground" : "bg-primary text-primary-foreground sm:col-span-2"}`}
          >
            Start watching
          </button>
        </div>
      </div>
    </div>
  );
};
