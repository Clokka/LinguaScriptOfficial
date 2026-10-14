import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useXp } from "@/contexts/XpContext";
import { usePet } from "@/contexts/PetContext";
import { playDing } from "@/lib/sound";

interface Props {
  text: string;
  language: string; // short code e.g. "fr"
  className?: string;
}

// Short-code → BCP-47 for SpeechRecognition
const LANG_MAP: Record<string, string> = {
  fr: "fr-FR", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT",
  zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ar: "ar-SA", hi: "hi-IN",
  ru: "ru-RU", tr: "tr-TR", nl: "nl-NL", pl: "pl-PL", sv: "sv-SE",
  th: "th-TH", en: "en-US",
};

type SR = typeof window extends { SpeechRecognition: infer T } ? T : any;

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// Letters only (keep combining marks so Hindi/Thai survive), no spaces, so
// Chinese/Japanese/Thai — written without spaces — are compared fairly too.
function letters(s: string) {
  return s
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ") // [music], (laughs)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

function levenshtein(a: string[], b: string[]): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Character similarity 0–100 between the line and what was heard. */
function scoreMatch(target: string, spoken: string): number {
  const t = Array.from(letters(target));
  const s = Array.from(letters(spoken));
  if (!t.length || !s.length) return 0;
  const dist = levenshtein(t, s);
  return Math.max(0, Math.round((1 - dist / Math.max(t.length, s.length)) * 100));
}

export const PronunciationJudge = ({ text, language, className }: Props) => {
  const SR = getSpeechRecognition();
  const bcp47 = LANG_MAP[language?.toLowerCase()] || null;
  const recRef = useRef<any>(null);
  const timeoutRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<{ pct: number; band: "excellent" | "good" | "keep"; spoken: string } | null>(null);
  const { award } = useXp();
  const { triggerReaction } = usePet();

  useEffect(() => {
    return () => {
      if (recRef.current) try { recRef.current.abort(); } catch {}
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!SR || !bcp47) return null;

  const stop = () => {
    if (recRef.current) try { recRef.current.stop(); } catch {}
    setRecording(false);
  };

  const start = () => {
    if (recording) { stop(); return; }
    setResult(null);
    const rec = new SR();
    rec.lang = bcp47;
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    recRef.current = rec;
    rec.onresult = (e: any) => {
      const alts: string[] = Array.from(e.results?.[0] || []).map((a: any) => a?.transcript || "");
      let spoken = alts[0] || "";
      let pct = 0;
      for (const a of alts) { const p = scoreMatch(text, a); if (p > pct) { pct = p; spoken = a; } }
      const band: "excellent" | "good" | "keep" = pct >= 90 ? "excellent" : pct >= 60 ? "good" : "keep";
      setResult({ pct, band, spoken });
      try { award("review_card" as any, { correct: band !== "keep" }); } catch {}
      if (band !== "keep") {
        playDing("success");
        try { triggerReaction("happy"); } catch {}
      }
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => {
      setRecording(false);
      if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
    try {
      rec.start();
      setRecording(true);
      timeoutRef.current = window.setTimeout(() => stop(), Math.min(15000, 4000 + text.length * 120));
    } catch {
      setRecording(false);
    }
  };

  const bandColor =
    result?.band === "excellent" ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/40"
    : result?.band === "good" ? "text-orange-300 bg-orange-500/15 border-orange-500/40"
    : result ? "text-red-300 bg-red-500/15 border-red-500/40" : "";
  const bandLabel =
    result?.band === "excellent" ? "Excellent"
    : result?.band === "good" ? "Good Try"
    : result ? "Keep Practising" : "";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={start}
        title={recording ? "Stop recording" : "Say this line"}
        aria-label={recording ? "Stop recording" : "Say this line"}
        className={cn(
          "relative shrink-0 rounded-full p-1.5 border transition-colors",
          recording
            ? "bg-red-500/20 border-red-400/60 text-red-300"
            : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10",
        )}
      >
        {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        {recording && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </button>
      {result && (
        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", bandColor)}>
          {result.pct}% · {bandLabel}
        </span>
      )}
    </div>
  );
};
