import { useEffect, useRef, useState } from "react";
import { Volume2, Check, X, ArrowRight, Snail } from "lucide-react";
import { DECK } from "@/lib/deck-colors";
import { speakWord } from "@/components/RecogniseStep";
import { cleanToken } from "@/lib/lsTeaching";

const GREEN = DECK.green;

/** Strip accents so "ete" vs "été" counts as a near miss, not a fail. */
const bare = (s: string) => cleanToken(s).normalize("NFD").replace(/\p{M}/gu, "").trim();

function speakSlow(word: string, language: string) {
  speakWord(word, language);
  try {
    const u = window.speechSynthesis;
    // speakWord cancels first; re-issue slower.
    u.cancel();
    const x = new SpeechSynthesisUtterance(word);
    x.lang = language;
    x.rate = 0.55;
    u.speak(x);
  } catch {
    /* ignore */
  }
}

/**
 * Listening: hear the word with no text on screen, type what you heard.
 * Builds sound → spelling mapping. Accent-only slips pass with a note.
 */
export function DictationStep({
  word,
  language,
  meaning,
  onComplete,
}: {
  word: string;
  language: string;
  meaning?: string;
  onComplete: (correct: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"right" | "accent" | "wrong" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => speakWord(word, language), 300);
    input.current?.focus();
    return () => clearTimeout(t);
  }, [word, language]);

  const check = () => {
    if (!value.trim() || result) return;
    const a = cleanToken(value).trim();
    const t = cleanToken(word).trim();
    setResult(a === t ? "right" : bare(value) === bare(word) ? "accent" : "wrong");
    speakWord(word, language);
  };

  const ok = result === "right" || result === "accent";

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">Listen and type the word you hear</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={() => speakWord(word, language)}
          aria-label="Play word"
          className="flex h-20 w-20 items-center justify-center rounded-full text-background"
          style={{ background: GREEN }}
        >
          <Volume2 className="h-9 w-9" />
        </button>
        <button
          onClick={() => speakSlow(word, language)}
          aria-label="Play slowly"
          className="flex h-12 w-12 items-center justify-center self-end rounded-full border border-border text-muted-foreground"
        >
          <Snail className="h-5 w-5" />
        </button>
      </div>

      <input
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (result ? onComplete(ok) : check())}
        disabled={!!result}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Type what you hear"
        className="mt-6 w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-lg outline-none focus:border-foreground"
      />

      {result && (
        <div
          className="mt-4 rounded-xl border p-4"
          style={{ borderColor: ok ? `${GREEN}66` : "hsl(var(--destructive) / 0.5)" }}
        >
          <div className="flex items-center gap-2 font-bold">
            {ok ? <Check className="h-5 w-5" style={{ color: GREEN }} /> : <X className="h-5 w-5 text-destructive" />}
            {result === "right" ? "Spot on" : result === "accent" ? "Nearly — watch the accents" : "Not quite"}
          </div>
          <p className="mt-2 text-2xl font-extrabold">{word}</p>
          {meaning && <p className="text-sm text-muted-foreground">{meaning}</p>}
          {result === "wrong" && <p className="mt-1 text-sm text-muted-foreground">You typed “{value}”. It'll come back at the end.</p>}
        </div>
      )}

      <button
        onClick={() => (result ? onComplete(ok) : check())}
        disabled={!value.trim() && !result}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-background disabled:opacity-50"
        style={{ background: GREEN }}
      >
        {result ? "Continue" : "Check"} <ArrowRight className="h-4 w-4" />
      </button>
      {!result && (
        <button onClick={() => { setResult("wrong"); speakWord(word, language); }} className="mt-2 w-full py-2 text-sm text-muted-foreground">
          I can't tell — show me
        </button>
      )}
    </div>
  );
}
