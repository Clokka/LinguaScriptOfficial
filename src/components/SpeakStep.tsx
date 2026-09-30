import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, ArrowRight } from "lucide-react";
import { DECK } from "@/lib/deck-colors";
import { speakWord } from "@/components/RecogniseStep";

const GREEN = DECK.green;

const LANG_MAP: Record<string, string> = {
  fr: "fr-FR", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT",
  zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ar: "ar-SA", hi: "hi-IN",
  ru: "ru-RU", tr: "tr-TR", nl: "nl-NL", pl: "pl-PL", sv: "sv-SE",
  th: "th-TH", en: "en-US",
};

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/** True when this browser can check speech in this language. */
export function speakingSupported(language: string) {
  return !!getSR() && !!LANG_MAP[language?.toLowerCase()];
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);

/**
 * Speaking (shadowing): hear the word in its sentence, then say it aloud.
 * Production + pronunciation. Low stakes: speech recognition is imperfect,
 * so this never affects scheduling — it just gives practice and feedback.
 */
export function SpeakStep({
  word,
  sentence,
  translation,
  language,
  onComplete,
}: {
  word: string;
  sentence?: string;
  translation?: string | null;
  language: string;
  onComplete: (ok: boolean) => void;
}) {
  const target = sentence || word;
  const recRef = useRef<any>(null);
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    speakWord(target, language);
    return () => { try { recRef.current?.abort(); } catch { /* ignore */ } };
  }, [target, language]);

  const spoken = heard ? new Set(norm(heard)) : null;
  const wordHit = spoken ? norm(word).every((w) => spoken.has(w)) : false;
  const t = norm(target);
  const pct = spoken && t.length ? Math.round((t.filter((w) => spoken.has(w)).length / t.length) * 100) : 0;
  const ok = wordHit && pct >= 60;

  const start = () => {
    if (recording) { try { recRef.current?.stop(); } catch { /* ignore */ } return; }
    const SR = getSR();
    if (!SR) return;
    const rec = new SR();
    rec.lang = LANG_MAP[language.toLowerCase()];
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e: any) => {
      const alts = Array.from(e.results[0] || []).map((a: any) => a.transcript as string);
      setHeard(alts.join(" "));
      setTries((n) => n + 1);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    setHeard(null);
    setRecording(true);
    try { rec.start(); } catch { setRecording(false); }
  };

  return (
    <div className="rounded-2xl border bg-card p-6" style={{ borderColor: `${GREEN}55` }}>
      <p className="text-sm text-muted-foreground">Listen, then say it out loud</p>
      <div className="mt-3 flex items-start gap-3">
        <button
          onClick={() => speakWord(target, language)}
          className="rounded-full p-2"
          style={{ background: `${GREEN}22`, color: GREEN }}
          aria-label="Play again"
        >
          <Volume2 className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xl font-semibold">
            {target.split(/(\s+)/).map((p, i) =>
              norm(p).some((w) => norm(word).includes(w)) ? (
                <span key={i} style={{ color: GREEN }}>{p}</span>
              ) : (
                <span key={i}>{p}</span>
              ),
            )}
          </p>
          {translation && <p className="mt-1 text-sm text-muted-foreground">{translation}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={start}
          className="flex h-16 w-16 items-center justify-center rounded-full text-background"
          style={{ background: GREEN }}
          aria-label={recording ? "Stop recording" : "Start speaking"}
        >
          {recording ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
        </button>
        <p className="text-xs text-muted-foreground">{recording ? "Listening…" : "Tap and speak"}</p>
      </div>

      {heard !== null && (
        <div className="mt-4 rounded-xl p-4 text-center" style={{ background: ok ? `${GREEN}18` : "hsl(var(--muted))" }}>
          <p className="font-semibold" style={{ color: ok ? GREEN : undefined }}>
            {ok ? "Clear! That sounded right." : wordHit ? `Nearly — ${pct}% of the sentence came through.` : `We didn't catch "${word}". Listen again and try once more.`}
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-between gap-3">
        <button onClick={() => onComplete(false)} className="text-sm text-muted-foreground underline">
          Can't speak now
        </button>
        {(ok || tries >= 2) && (
          <button
            onClick={() => onComplete(ok)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2 font-semibold text-background"
            style={{ background: GREEN }}
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
