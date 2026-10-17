import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WordPopup } from "@/components/WordPopup";
import { Flashcard } from "@/components/Flashcard";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { LineBlastOverlay } from "@/components/LineBlastOverlay";
import {
  PRAISE, prefersReducedMotion, floatXpText, confettiCountForCombo,
  scatterClones, goldSweep, makeConfettiBurst, type ConfettiBurst,
} from "@/lib/lineBlast";
import { DECK, CELEBRATION_GOLD } from "@/lib/deck-colors";
import type { DemoLine } from "@/lib/landingDemoLines";

/**
 * The real LinguaScript loop, on the landing page, using the app's own parts:
 *
 *   orange ring (ls-target-ring) on a top-50 word → WordPopup "Save to
 *   Flashcards" → red deck → the real Flashcard (Got it! / Again / Too hard)
 *   → orange → green → GOLD the first time → tap the gold word → green.
 *   Every word green → Line Blast. No comprehension board here: that score
 *   only means something after a real rewatch, so it stays in the app.
 *
 * No account, nothing saved: all state lives here. The ring is the only
 * instruction — it moves to whatever the visitor should tap next.
 */

type Tier = -1 | 0 | 1 | 2 | 3; // white, red, orange, green, gold (first time green, not yet tapped)
type DeckState = "red" | "orange" | "green";
const COLOR: Record<Tier, string> = { [-1]: "#F4F7F5", 0: DECK.red, 1: DECK.orange, 2: DECK.green, 3: CELEBRATION_GOLD };
const STATE: Record<0 | 1 | 2, DeckState> = { 0: "red", 1: "orange", 2: "green" };
const DECKS = [
  { t: 0 as const, name: "New", c: DECK.red },
  { t: 1 as const, name: "Learning", c: DECK.orange },
  { t: 2 as const, name: "Known", c: DECK.green },
];

const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:¡¿。、！？]/g, "").trim();

interface Props {
  line: DemoLine;
  language: string;
  languageLabel: string;
  onTry: () => void;
}

export const CoreLoopDemo = ({ line, language, languageLabel, onTry }: Props) => {
  const n = line.words.length;
  const [tiers, setTiers] = useState<Tier[]>(() => line.words.map(() => -1 as Tier));
  const [top50, setTop50] = useState<string[] | null>(null);
  const [popup, setPopup] = useState<{ i: number; x: number; y: number } | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [blasted, setBlasted] = useState(false);
  const [praise, setPraise] = useState<{ big: string; sub: string; combo: number; key: number } | null>(null);
  const [floatXp, setFloatXp] = useState<{ text: string; key: number } | null>(null);
  const [glowKey, setGlowKey] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef<ConfettiBurst | null>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    burstRef.current = makeConfettiBurst(canvasRef.current);
    return () => burstRef.current?.reset();
  }, []);

  // Fresh line for a new language, and the real top-50 list for that language.
  useEffect(() => {
    setTiers(line.words.map(() => -1 as Tier));
    setPopup(null); setReviewing(null); setBlasted(false);
    setTop50(null);
    let alive = true;
    (supabase as any)
      .from("core_vocabulary")
      .select("word, lemma, rank")
      .eq("language", language)
      .order("rank", { ascending: true })
      .limit(50)
      .then(({ data }: any) => {
        if (!alive || !Array.isArray(data) || data.length === 0) return;
        setTop50(data.map((r: any) => norm(r.word || r.lemma)));
      });
    return () => { alive = false; };
  }, [line, language]);

  /** Position in the top 50 (1-based) for a line word, if it's there. */
  const rankOf = (i: number): number | null => {
    if (!top50) return null;
    const p = top50.indexOf(norm(line.words[i].w));
    return p >= 0 ? p + 1 : null;
  };

  // The ringed word: the most common word in the line by our real list,
  // otherwise the line's own pick.
  const target = useMemo(() => {
    let best = -1, bestRank = Infinity;
    line.words.forEach((_, i) => {
      const r = rankOf(i);
      if (r != null && r < bestRank) { best = i; bestRank = r; }
    });
    return best >= 0 ? best : Math.min(n - 1, line.target ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top50, line]);
  const targetRank = rankOf(target);

  // The card due for review: red before orange.
  const due = useMemo(() => {
    for (const t of [0, 1] as const) {
      const i = tiers.findIndex((x) => x === t);
      if (i >= 0) return i;
    }
    return -1;
  }, [tiers]);

  const counts = [0, 1, 2].map((t) => tiers.filter((x) => (t === 2 ? x === 2 || x === 3 : x === t)).length);
  const goldIdx = tiers.findIndex((t) => t === 3);
  const allGreen = tiers.every((t) => t === 2);
  const mascot: ChameleonTier = tiers.some((t) => t === 0) ? "red" : tiers.some((t) => t === 1) ? "orange" : "green";

  // Where the orange ring goes next: the gold word, then a due deck, then the target word.
  const ringWord = goldIdx >= 0 ? goldIdx : tiers[target] === -1 ? target : -1;
  const ringDeck = goldIdx < 0 && due >= 0 && !popup && reviewing == null ? tiers[due] : -1;

  const set = (i: number, t: Tier) => setTiers((all) => all.map((x, j) => (j === i ? t : x)) as Tier[]);

  const blast = () => {
    setBlasted(true);
    if (prefersReducedMotion()) {
      setPraise({ big: PRAISE[3][0], sub: PRAISE[3][1], combo: 3, key: Date.now() });
      return;
    }
    goldSweep(lineRef.current);
    window.setTimeout(() => {
      scatterClones(stageRef.current, lineRef.current, fxRef.current);
      burstRef.current?.fire(confettiCountForCombo(4));
      setGlowKey((k) => k + 1);
      setPraise({ big: PRAISE[4][0], sub: PRAISE[4][1], combo: 4, key: Date.now() });
      setFloatXp({ text: floatXpText(4), key: Date.now() });
    }, 420);
  };

  // Whole line green → Line Blast (once per line).
  useEffect(() => {
    if (allGreen && !blasted) blast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGreen]);

  const tapWord = (i: number) => {
    if (tiers[i] === 3) { set(i, 2); return; } // gold → green
    const r = wordRefs.current[i]?.getBoundingClientRect();
    if (r) setPopup({ i, x: r.left + r.width / 2, y: r.bottom + 8 });
  };

  const openDeck = (t: 0 | 1 | 2) => {
    const i = tiers.findIndex((x) => x === t);
    if (i >= 0 && t !== 2) setReviewing(i);
  };

  const replay = () => {
    lineRef.current?.querySelectorAll("span").forEach((s) => s.getAnimations().forEach((a) => a.cancel()));
    setBlasted(false);
    setTiers(line.words.map(() => -1 as Tier));
  };

  const savedTop = tiers.filter((t, i) => t !== -1 && rankOf(i) != null).length;
  const knownTop = tiers.filter((t, i) => (t === 2 || t === 3) && rankOf(i) != null).length;
  const pw = popup ? line.words[popup.i] : null;
  const rw = reviewing != null ? line.words[reviewing] : null;

  return (
    <div className="relative select-none">
      {/* ── The "video": chameleon + subtitle line ── */}
      <div
        ref={stageRef}
        className="relative rounded-2xl overflow-hidden border border-white/10 px-4 pt-3 pb-4"
        style={{ background: "radial-gradient(120% 90% at 30% 10%, #2a2a33 0%, #121218 55%, #0b0b10 100%)" }}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full z-40" />
        <div ref={fxRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-40" />

        <div className="w-14 sm:w-16"><ChameleonMascot tier={mascot} party={blasted} /></div>

        <div className="mt-2 sm:mt-6 mx-auto max-w-xl rounded-xl bg-black/45 px-3 py-3 text-center">
          <p
            ref={lineRef}
            className={`text-2xl sm:text-3xl font-bold leading-[1.6] ${line.noSpaces ? "" : "[word-spacing:0.15em]"}`}
            translate="no"
          >
            {line.words.map((wd, i) => (
              <span
                key={`${wd.w}-${i}`}
                ref={(el) => (wordRefs.current[i] = el)}
                role="button"
                tabIndex={0}
                onClick={() => tapWord(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapWord(i); } }}
                className={`cursor-pointer transition-colors duration-300 rounded-[10px] ${ringWord === i ? "ls-target-ring" : ""}`}
                style={{
                  color: COLOR[tiers[i]],
                  textShadow: tiers[i] === 3 ? `0 0 18px ${CELEBRATION_GOLD}aa` : undefined,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {wd.w}{line.noSpaces ? "" : " "}
              </span>
            ))}
          </p>
          {line.translation && <p className="mt-1 text-sm text-white/55">{line.translation}</p>}
        </div>
        <LineBlastOverlay praise={praise} floatXp={floatXp} glowKey={glowKey} placement="stage" />
      </div>

      {/* ── Decks, side by side so they fit on a phone ── */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {DECKS.map((d) => (
          <button
            key={d.name}
            onClick={() => openDeck(d.t)}
            className={`rounded-xl px-2 py-2 bg-white/[0.04] text-center ${ringDeck === d.t ? "ls-target-ring" : ""}`}
            style={{ border: `1px solid ${d.c}55` }}
            aria-label={`${d.name} deck, ${counts[d.t]} cards`}
          >
            <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wide" style={{ color: d.c }}>{d.name}</span>
            <span key={counts[d.t]} className="block text-lg font-bold tabular-nums text-white animate-in zoom-in-50 duration-300">{counts[d.t]}</span>
          </button>
        ))}
      </div>

      {/* ── Whole line green: the next step is a real show ── */}
      {blasted && (
        <button
          onClick={onTry}
          className="mt-2 w-full h-11 rounded-xl font-bold text-[#08080B] animate-in fade-in duration-500"
          style={{ backgroundColor: DECK.green }}
        >
          Try it with a real show
        </button>
      )}

      {/* ── Most-common-words progress, the same idea as the app's card ── */}
      <div
        className="overflow-hidden transition-all duration-500"
        style={{ maxHeight: savedTop > 0 ? 90 : 0, opacity: savedTop > 0 ? 1 : 0 }}
        aria-live="polite"
      >
        <div className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <p className="text-sm font-semibold text-white/85">
            {knownTop > 0
              ? <>You know <span style={{ color: DECK.green }}>{knownTop}</span> of the 50 most common {languageLabel} words</>
              : <>{savedTop} of the 50 most common {languageLabel} words added</>}
          </p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(Math.max(knownTop, savedTop) / 50) * 100}%`, backgroundColor: knownTop ? DECK.green : DECK.red }} />
          </div>
          {targetRank != null && (
            <p className="mt-1 text-[11px] text-white/40" translate="no">
              ({line.words[target].w.replace(/[.,]/g, "")} is #{targetRank} of the most common words in {languageLabel})
            </p>
          )}
        </div>
      </div>

      {blasted && (
        <button onClick={replay} className="mt-2 w-full text-sm text-white/50 hover:text-white/80">Play again</button>
      )}

      {/* ── Real word popup ── */}
      {popup && pw && (
        <WordPopup
          word={{ id: `demo-${popup.i}`, text: pw.w.replace(/[.,]/g, ""), translation: pw.m, pronunciation: "", ipa: "" }}
          position={{ x: popup.x, y: popup.y }}
          language={language}
          deckColor={COLOR[tiers[popup.i]]}
          onClose={() => setPopup(null)}
          onSave={() => { if (tiers[popup.i] === -1) set(popup.i, 0); setPopup(null); }}
        />
      )}

      {/* ── Real flashcard review ── */}
      {rw && reviewing != null && (tiers[reviewing] === 0 || tiers[reviewing] === 1) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setReviewing(null)}>
          <div className="w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setReviewing(null)} className="absolute -top-10 right-0 p-2 text-white/60 hover:text-white" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
            <Flashcard
              key={`${reviewing}-${tiers[reviewing]}`}
              word={rw.w.replace(/[.,]/g, "")}
              translation={rw.m}
              pronunciation=""
              ipa=""
              language={language}
              state={STATE[tiers[reviewing] as 0 | 1]}
              onCorrect={() => { const t = tiers[reviewing]; set(reviewing, t === 1 ? 3 : 1); setReviewing(null); }}
              onIncorrect={() => setReviewing(null)}
              onDemote={() => { set(reviewing, 0); setReviewing(null); }}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default CoreLoopDemo;
