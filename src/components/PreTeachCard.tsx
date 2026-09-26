import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Volume2, Loader2, Eye } from "lucide-react";
import { gradePreTeachVocab, type PreTeachItem } from "@/lib/preTeachVocab";

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

/** "Words to watch for" — the Present step before the video plays. */
export const PreTeachCard = ({ lines, language, level, goal, userId, onComplete }: Props) => {
  const [items, setItems] = useState<PreTeachItem[] | null>(null);

  useEffect(() => {
    if (!lines.length) return;
    let alive = true;
    gradePreTeachVocab({ lines, language, level, count: goal, userId })
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [lines, language, level, goal, userId]);

  // Nothing worth pre-teaching → go straight to the video.
  useEffect(() => {
    if (items && items.length === 0) onComplete();
  }, [items, onComplete]);

  return (
    <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur overflow-y-auto">
      <div className="max-w-xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest">
          <Eye className="w-4 h-4" /> Before you watch
        </div>
        <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-foreground">
          Look out for {items?.length || goal} words
        </h2>
        <p className="text-sm text-muted-foreground">
          These come up in the video — save them when you hear them.
        </p>

        {!items ? (
          <div className="flex items-center gap-2 text-muted-foreground mt-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Picking the most useful words…
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {items.map((it, i) => (
              <motion.li
                key={it.item}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{it.item}</span>
                  <span className="text-muted-foreground">— {it.translation}</span>
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
        )}

        <button
          onClick={onComplete}
          className="mt-5 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
        >
          Start watching
        </button>
      </div>
    </div>
  );
};
