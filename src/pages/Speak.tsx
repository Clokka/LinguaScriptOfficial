import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mic, Square, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useXp } from "@/contexts/XpContext";
import { PillarsNav, WordChip } from "@/components/PillarsNav";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { playDing } from "@/lib/sound";
import { track } from "@/lib/analytics";
import { normalizeToken } from "@/lib/vocab";
import {
  COLOUR_HEX,
  colourOf,
  getSpeakRuns,
  loadPillarDeck,
  promoteUsedWord,
  saveSpeakRun,
  tokenize,
  type PillarDeck,
} from "@/lib/pillars";

const LANG_MAP: Record<string, string> = {
  fr: "fr-FR", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT",
  zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ar: "ar-SA", hi: "hi-IN",
  ru: "ru-RU", tr: "tr-TR", nl: "nl-NL", pl: "pl-PL", sv: "sv-SE",
  th: "th-TH", en: "en-GB",
};
const getSR = (): any =>
  typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

const squash = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

/** Drop finals that a later final already repeats (Android sends cumulative text). */
function dedupeFinals(finals: string[]): string {
  const out: string[] = [];
  for (const f of finals) {
    const prev = out[out.length - 1];
    if (prev && squash(f).startsWith(squash(prev))) out[out.length - 1] = f; // f contains prev
    else if (prev && squash(prev).startsWith(squash(f))) continue; // f is already inside prev
    else out.push(f);
  }
  return out.join(" ");
}

/** Interim text often starts with what was already finalised — show only the new part. */
function stripRepeat(mid: string, said: string): string {
  const m = squash(mid);
  const s = squash(said);
  if (s && m.startsWith(s)) return mid.trim().slice(said.trim().length).trim();
  return mid.trim();
}

const OPTIONS = [1, 2, 3] as const;
const TARGET_MIN = 3;

/**
 * 🗣️ Pillar 3 — SPEAKING (autologia). Ramble for 3 minutes.
 * Your newest red words sit on screen; say them and they light up.
 * Common words come out green, red words red, as you speak.
 */
export default function Speak() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { learningLanguage } = useLanguage();
  const { award } = useXp();
  const lang = learningLanguage || "fr";

  const [deck, setDeck] = useState<PillarDeck | null>(null);
  const [minutes, setMinutes] = useState<number>(TARGET_MIN);
  const [phase, setPhase] = useState<"ready" | "live" | "done">("ready");
  const [left, setLeft] = useState(TARGET_MIN * 60);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [promoted, setPromoted] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState(() => getSpeakRuns(lang));
  const [micError, setMicError] = useState<string | null>(null);

  const recRef = useRef<any>(null);
  /** Text from earlier recognition sessions (Chrome restarts after pauses). */
  const baseRef = useRef("");
  /** Text from the current session. */
  const sessionRef = useRef("");
  const liveRef = useRef(false);
  const startedAt = useRef(0);
  const tickRef = useRef<number | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const supported = !!getSR() && !!LANG_MAP[lang];

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    loadPillarDeck(user.id, lang).then(setDeck);
    setRuns(getSpeakRuns(lang));
  }, [user, lang]);

  /** The newest red flashcards — the words to work into what you say. */
  const targets = useMemo(() => (deck ? deck.red.slice(0, 8) : []), [deck]);
  const targetKeys = useMemo(() => new Map(targets.map((w) => [normalizeToken(w.word), w])), [targets]);

  // Spot red words as they're said.
  const scan = useCallback(
    (text: string) => {
      const hits: string[] = [];
      for (const p of tokenize(text)) {
        if (!p.word) continue;
        const k = normalizeToken(p.text);
        if (targetKeys.has(k)) hits.push(k);
      }
      if (!hits.length) return;
      setUsed((prev) => {
        const fresh = hits.filter((h) => !prev.has(h));
        if (!fresh.length) return prev;
        playDing("soft");
        const n = new Set(prev);
        fresh.forEach((h) => n.add(h));
        return n;
      });
    },
    [targetKeys],
  );

  const stopRecognition = () => {
    liveRef.current = false;
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    recRef.current = null;
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const finish = useCallback(async () => {
    stopRecognition();
    setPhase("done");
    setInterim("");
    const seconds = Math.min(minutes * 60, Math.round((Date.now() - startedAt.current) / 1000));
    const words = tokenize(finalText).filter((p) => p.word).length;
    const redUsed = Array.from(used);
    saveSpeakRun(lang, { seconds, target: minutes * 60, words, redUsed, at: new Date().toISOString() });
    track("speak_finished", { seconds, target_minutes: minutes, words, red_used: redUsed.length, red_shown: targets.length, language: lang });
    setRuns(getSpeakRuns(lang));
    if (seconds >= 60) award("review_card", { correct: true });
    if (seconds >= TARGET_MIN * 60) playDing("success");
    // Saying a red word out loud is a real use of it: red → orange.
    if (user) {
      const next: Record<string, string> = {};
      for (const k of redUsed) {
        const w = targetKeys.get(k);
        if (w) next[w.word] = await promoteUsedWord(user.id, w);
      }
      setPromoted(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, finalText, used, lang, user, targetKeys]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  const start = async () => {
    const SR = getSR();
    if (!SR) return;
    setMicError(null);
    setFinalText("");
    baseRef.current = "";
    sessionRef.current = "";
    setInterim("");
    setUsed(new Set());
    setPromoted({});
    setLeft(minutes * 60);
    startedAt.current = Date.now();
    liveRef.current = true;
    setPhase("live");

    const open = () => {
      const rec = new SR();
      rec.lang = LANG_MAP[lang];
      // Android Chrome's continuous mode re-sends earlier words, so on Android
      // listen one phrase at a time (onend starts the next one straight away).
      rec.continuous = !/Android/i.test(navigator.userAgent);
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      // Rebuild this session's text from ALL results every time. Android
      // Chrome re-sends earlier finals (each one repeats the ones before it),
      // so appending made everything you said show up two or three times.
      rec.onresult = (e: any) => {
        const finals: string[] = [];
        let mid = "";
        for (let i = 0; i < e.results.length; i++) {
          const t = String(e.results[i][0].transcript || "").trim();
          if (!t) continue;
          if (e.results[i].isFinal) finals.push(t);
          else mid += (mid ? " " : "") + t;
        }
        const session = dedupeFinals(finals);
        sessionRef.current = session;
        const said = baseRef.current + session;
        setFinalText(said);
        const midClean = stripRepeat(mid, session);
        setInterim(midClean ? (said ? " " : "") + midClean : "");
        scan(said + " " + midClean);
      };
      rec.onerror = (e: any) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setMicError("🎙️ ✕");
          liveRef.current = false;
          setPhase("ready");
        }
      };
      // Chrome ends a session after a pause — keep listening until time's up.
      rec.onend = () => {
        // Keep what this session heard, then start a fresh one.
        // (Skip it if it's the same phrase again — Android sometimes repeats the last one.)
        const sess = sessionRef.current;
        if (sess && !squash(baseRef.current).endsWith(squash(sess))) baseRef.current += sess + " ";
        sessionRef.current = "";
        if (liveRef.current) { try { open(); } catch { /* retry next tick */ } }
      };
      recRef.current = rec;
      rec.start();
    };
    try { open(); } catch { setMicError("🎙️ ✕"); setPhase("ready"); return; }

    tickRef.current = window.setInterval(() => {
      const s = minutes * 60 - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, s));
      if (s <= 0) finishRef.current();
    }, 250);
  };

  useEffect(() => () => stopRecognition(), []);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({ block: "nearest" }); }, [finalText, interim]);

  const total = minutes * 60;
  const elapsed = phase === "ready" ? 0 : total - left;
  const pct = Math.min(1, elapsed / total);
  const usedCount = used.size;
  const tier: ChameleonTier = usedCount >= 3 || (phase === "done" && elapsed >= TARGET_MIN * 60) ? "green" : usedCount >= 1 ? "orange" : "red";
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const R = 88;
  const C = 2 * Math.PI * R;

  if (!user || !deck) {
    return (
      <div className="min-h-screen bg-background">
        <PillarsNav />
        <div className="grid place-items-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  const spoken = finalText + interim;
  const best = runs.reduce((m, r) => Math.max(m, r.seconds), 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo title="Speak · LinguaScript" description="The 3-minute speaking challenge." path="/speak" />
      <PillarsNav />
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Timer ring with the chameleon inside */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-[200px] h-[200px]">
            <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
              <circle cx="100" cy="100" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
              <circle
                cx="100" cy="100" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
                stroke={COLOUR_HEX[tier]}
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                style={{ transition: "stroke-dashoffset .25s linear, stroke .4s" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center">
                <ChameleonMascot tier={tier} party={phase === "done" && elapsed >= TARGET_MIN * 60} dance={phase === "live"} className="w-20 h-20" />
                <span className="text-3xl font-black tabular-nums">{phase === "ready" ? `${minutes}:00` : `${mm}:${ss}`}</span>
              </div>
            </div>
          </div>

          {/* 1 · 2 · 3 minutes — 3 is the target */}
          {phase !== "live" && (
            <div className="flex gap-2" role="radiogroup" aria-label="Minutes">
              {OPTIONS.map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={minutes === m}
                  onClick={() => { setMinutes(m); setLeft(m * 60); }}
                  className={`relative w-16 h-12 rounded-2xl border text-lg font-bold transition-all ${minutes === m ? "border-primary bg-primary/15" : "border-border bg-card"}`}
                >
                  {m}′
                  {m === TARGET_MIN && <span className="absolute -top-2 -right-2 text-sm">🎯</span>}
                </button>
              ))}
            </div>
          )}

          {!supported ? (
            <p className="text-sm text-muted-foreground text-center">🎙️ Chrome / Edge</p>
          ) : phase === "live" ? (
            <Button size="lg" variant="outline" className="rounded-full w-16 h-16 p-0" onClick={() => finish()} aria-label="Stop">
              <Square className="w-6 h-6" />
            </Button>
          ) : (
            <Button size="lg" className="rounded-full w-16 h-16 p-0" onClick={start} aria-label="Start speaking">
              {phase === "done" ? <RotateCcw className="w-6 h-6" /> : <Mic className="w-7 h-7" />}
            </Button>
          )}
          {micError && <p className="text-sm text-destructive">{micError}</p>}
        </div>

        {/* Your newest red flashcards — use them! */}
        {targets.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {targets.map((w) => {
              const k = normalizeToken(w.word);
              const p = promoted[w.word] as keyof typeof COLOUR_HEX | undefined;
              return (
                <WordChip key={w.id} word={w.word} sub={w.translation} colour={COLOUR_HEX[p || "red"]} done={used.has(k)} />
              );
            })}
          </div>
        ) : (
          <div className="text-center">
            <Button variant="outline" onClick={() => navigate("/discover")}>🔴 0 · 📖🎬</Button>
          </div>
        )}

        {/* What you're saying, in deck colours */}
        {(phase !== "ready" || spoken) && (
          <section className="rounded-3xl border border-border bg-card p-5 min-h-[140px] max-h-[40vh] overflow-y-auto text-xl leading-relaxed" translate="no" aria-live="polite">
            {spoken.trim() ? (
              tokenize(spoken).map((p, i) => {
                if (!p.word) return <span key={i}>{p.text}</span>;
                const k = normalizeToken(p.text);
                const c = targetKeys.has(k) ? "red" : colourOf(deck, p.text);
                return (
                  <span
                    key={i}
                    style={{
                      color: c ? COLOUR_HEX[c] : undefined,
                      fontWeight: c === "red" ? 800 : undefined,
                      opacity: i >= tokenize(finalText).length ? 0.7 : 1,
                    }}
                  >
                    {p.text}
                  </span>
                );
              })
            ) : (
              <span className="text-muted-foreground">🎙️ …</span>
            )}
            <div ref={transcriptEnd} />
          </section>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat value={`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`} label="⏱" good={elapsed >= TARGET_MIN * 60} />
            <Stat value={String(tokenize(finalText).filter((p) => p.word).length)} label="💬" />
            <Stat value={`${usedCount}/${targets.length}`} label="🔴→🟠" good={usedCount > 0} />
          </div>
        )}

        {best > 0 && phase === "ready" && (
          <p className="text-center text-sm text-muted-foreground">
            🏆 {Math.floor(best / 60)}:{String(best % 60).padStart(2, "0")} · 🔥 {runs.filter((r) => r.seconds >= TARGET_MIN * 60).length}× 3′
          </p>
        )}
      </main>
    </div>
  );
}

function Stat({ value, label, good }: { value: string; label: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card py-3">
      <div className="text-2xl font-black tabular-nums" style={{ color: good ? COLOUR_HEX.green : undefined }}>{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
