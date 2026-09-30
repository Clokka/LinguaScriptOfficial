import { useEffect, useMemo, useState } from "react";
import { Volume2, Check, X, ArrowRight } from "lucide-react";
import { DECK } from "@/lib/deck-colors";
import { shuffle } from "@/lib/lsTeaching";

const GREEN = DECK.green;

const TTS: Record<string, string> = {
  fr: "fr-FR", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT", zh: "zh-CN", ja: "ja-JP",
  ko: "ko-KR", ar: "ar-SA", hi: "hi-IN", th: "th-TH", ru: "ru-RU", tr: "tr-TR", nl: "nl-NL",
  pl: "pl-PL", sv: "sv-SE", en: "en-GB",
};

export function speakWord(word: string, language: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = TTS[language] || language;
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  } catch {
    /* no audio available */
  }
}

/**
 * Hear the word, pick its meaning from 4. After answering, a feedback card
 * shows the word in its sentence with the translation — and, if wrong, what
 * the picked option actually means. Corrective feedback is where learning is.
 */
export function RecogniseStep({
  word,
  meaning,
  distractors,
  language,
  sentence,
  sentenceTranslation,
  pairHint,
  onComplete,
}: {
  word: string;
  meaning: string;
  distractors: { meaning: string; word?: string }[];
  language: string;
  sentence?: string;
  sentenceTranslation?: string;
  pairHint?: string | null;
  onComplete: (correct: boolean) => void;
}) {
  const options = useMemo(
    () => shuffle([{ meaning }, ...distractors.slice(0, 3)]),
    [meaning, distractors],
  );
  const [picked, setPicked] = useState<{ meaning: string; word?: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => speakWord(word, language), 300);
    return () => clearTimeout(t);
  }, [word, language]);

  const correct = picked?.meaning === meaning;

  return (
    <div className="mx-auto max-w-md rounded-2xl border p-6" style={{ borderColor: `${GREEN}55`, background: `${GREEN}14` }}>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>
        Listen and pick the meaning
      </p>
      <button
        onClick={() => speakWord(word, language)}
        aria-label="Play the word again"
        className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full text-background transition-transform active:scale-95"
        style={{ background: GREEN }}
      >
        <Volume2 className="h-9 w-9" />
      </button>
      {picked && <p className="mt-4 text-center text-2xl font-extrabold">{word}</p>}

      <div className="mt-6 space-y-2">
        {options.map((o) => {
          const isRight = o.meaning === meaning;
          const show = picked !== null;
          return (
            <button
              key={o.meaning}
              disabled={show}
              onClick={() => setPicked(o)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left font-semibold transition-colors"
              style={
                show && isRight
                  ? { borderColor: GREEN, color: GREEN }
                  : show && o === picked
                    ? { borderColor: DECK.red, color: DECK.red }
                    : undefined
              }
            >
              {o.meaning}
              {show && isRight && <Check className="h-5 w-5" />}
              {show && !isRight && o === picked && <X className="h-5 w-5" />}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm">
          <p>
            <b>{word}</b> = {meaning}
          </p>
          {!correct && (
            <p className="mt-1 text-muted-foreground">
              You picked “{picked.meaning}”{picked.word ? ` — that's “${picked.word}”` : ""}.
            </p>
          )}
          {pairHint && (
            <p className="mt-1 text-muted-foreground">
              Works as a pair: <b>{pairHint}</b>
            </p>
          )}
          {sentence && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="font-medium">{sentence}</p>
              {sentenceTranslation && <p className="mt-1 text-muted-foreground">{sentenceTranslation}</p>}
            </div>
          )}
        </div>
      )}

      {picked && (
        <button
          onClick={() => onComplete(correct)}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-background"
          style={{ background: GREEN }}
        >
          {correct ? "Next" : "Got it — I'll see it again"} <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
