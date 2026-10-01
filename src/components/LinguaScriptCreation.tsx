import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Loader2 } from "lucide-react";
import { evaluateLinguaScripts } from "@/lib/linguaScriptEvaluation";

interface Sentence {
  word: string;
  userText: string;
  score: number;
  feedback: string;
}

export interface CreationItem {
  word: string;
  example?: string;
  exampleTranslation?: string;
}

interface LinguaScriptCreationProps {
  items: CreationItem[];
  onComplete: (data: { sentences: Sentence[]; totalXp: number }) => void;
  onSkip: () => void;
  /** Language the sentences are written in (the word's own language). */
  language: string;
  nativeLanguage?: string;
}

/**
 * One word per screen, with the word's own example shown as a model, marked
 * straight away. Writing five unsupported sentences at once was the hardest
 * possible task with the slowest possible feedback.
 */
export function LinguaScriptCreation({ items, onComplete, onSkip, language, nativeLanguage = "en" }: LinguaScriptCreationProps) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [done, setDone] = useState<Sentence[]>([]);
  const [result, setResult] = useState<Sentence | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = items[idx];
  if (!item) return null;

  const check = async () => {
    setError(null);
    setBusy(true);
    try {
      const [r] = await evaluateLinguaScripts([{ word: item.word, text }], language, nativeLanguage);
      setResult({ word: item.word, userText: text, score: r?.score ?? 0, feedback: r?.feedback ?? "" });
    } catch {
      setError("We couldn't check that just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const next = (skipped = false) => {
    const all = skipped
      ? [...done, { word: item.word, userText: "", score: 0, feedback: "" }]
      : [...done, result!];
    setResult(null);
    setText("");
    if (idx + 1 >= items.length) {
      onComplete({ sentences: all, totalXp: all.reduce((s, x) => s + x.score, 0) });
    } else {
      setDone(all);
      setIdx(idx + 1);
    }
  };

  const good = (result?.score ?? 0) >= 15;

  return (
    <section className="rounded-2xl border border-[#34C759]/40 bg-card p-6 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#34C759]">
        Your turn · {idx + 1} of {items.length}
      </p>
      <h2 className="text-2xl font-bold text-foreground">
        Write one short sentence with <span className="text-[#34C759]">{item.word}</span>
      </h2>
      {item.example && (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Example</p>
          <p className="text-foreground">{item.example}</p>
          {item.exampleTranslation && (
            <p className="text-sm text-muted-foreground">{item.exampleTranslation}</p>
          )}
        </div>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!!result || busy}
        placeholder="Change one or two words in the example, or write your own…"
        className="min-h-[90px]"
      />
      {result && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            good ? "border-[#34C759]/40 bg-[#34C759]/10" : "border-destructive/40 bg-destructive/10"
          }`}
        >
          <p className={`font-semibold ${good ? "text-[#34C759]" : "text-destructive"}`}>
            {good ? "Nice" : "Not quite"} · +{result.score} XP
          </p>
          {result.feedback && <p className="mt-1 text-foreground">{result.feedback}</p>}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        {!result ? (
          <>
            <button
              onClick={check}
              disabled={busy || !text.trim()}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-[#34C759] py-3 font-semibold text-background disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Check <ArrowRight className="ml-2 h-4 w-4" /></>}
            </button>
            <button
              onClick={() => (idx === 0 && !done.length ? onSkip() : next(true))}
              className="rounded-xl border border-border px-5 text-muted-foreground"
            >
              Skip
            </button>
          </>
        ) : (
          <button
            onClick={() => next()}
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-[#34C759] py-3 font-semibold text-background"
          >
            {idx + 1 >= items.length ? "Finish" : "Next word"} <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}
