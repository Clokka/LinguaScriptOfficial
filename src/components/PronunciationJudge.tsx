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
  en: "en-US",
};

type SR = typeof window extends { SpeechRecognition: infer T } ? T : any;

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreMatch(target: string, spoken: string): number {
  const t = normalize(target);
  const s = new Set(normalize(spoken));
  if (t.length === 0) return 0;
  const hits = t.filter((w) => s.has(w)).length;
  return Math.round((hits / t.length) * 100);
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
    rec.maxAlternatives = 1;
    rec.continuous = false;
    recRef.current = rec;
    rec.onresult = (e: any) => {
      const spoken = e.results?.[0]?.[0]?.transcript || "";
      const pct = scoreMatch(text, spoken);
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
      timeoutRef.current = window.setTimeout(() => stop(), 5000);
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
