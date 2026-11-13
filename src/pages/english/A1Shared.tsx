// Shared bits for the English A1 guide pages (/english/a1/*).
import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Volume2 } from "lucide-react";
import { loadA1, saveA1, type A1Progress } from "@/lib/english/a1/progress";
import { richParts } from "@/lib/english/a1/grammar";

const TABS = [
  { to: "/english/a1", label: "Guide", end: true },
  { to: "/english/a1/grammar", label: "Grammar" },
  { to: "/english/a1/words", label: "100 words" },
  { to: "/english/a1/test", label: "Practice test" },
  { to: "/english/exams", label: "Exams & study abroad" },
  { to: "/english/a1/sources", label: "Sources" },
];

export function A1Nav() {
  return (
    <nav aria-label="English A1 guide" className="not-prose -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}
          className={({ isActive }) => `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Reads the browser's English voice. No network, works offline. */
export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.9;
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en-gb")) || synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en"));
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch { /* no speech on this device */ }
}

export function SpeakButton({ text, label = "Listen" }: { text: string; label?: string }) {
  return (
    <button type="button" onClick={() => speak(text)} aria-label={`${label}: ${text}`}
      className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
      <Volume2 className="h-4 w-4" />
    </button>
  );
}

/** Unit text with **bold** parts; English examples are learning text (translate="no"). */
export function Rich({ text, english = false }: { text: string; english?: boolean }) {
  return (
    <span translate={english ? "no" : undefined}>
      {richParts(text).map((p, i) => p.b ? <strong key={i} className="text-foreground">{p.t}</strong> : <span key={i}>{p.t}</span>)}
    </span>
  );
}

export function useA1Progress(): [A1Progress, (fn: (p: A1Progress) => A1Progress) => void] {
  const [p, setP] = useState<A1Progress>(() => loadA1());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === "ls.a1.v1") setP(loadA1()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const update = useCallback((fn: (p: A1Progress) => A1Progress) => {
    setP((prev) => { const next = fn(prev); saveA1(next); return next; });
  }, []);
  return [p, update];
}

export function Bar({ pct, color = "bg-primary" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pct}%`}>
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
