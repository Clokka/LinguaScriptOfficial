// Sentence Lab — LinguaScripts' Block Blast replacement.
//
// The old flow drilled meaningless fragments ("s'en", "partent") behind
// overwhelming totals ("352 due · 352 min · +5280 XP"). This is retired
// (see Browse.tsx / DailyGoalTally / Watch.tsx — every entry point into it
// is gone, though its route, tables and component are untouched).
//
// The replacement: a short session of real sentence frames with one gap
// each, filled by dragging a block built from the learner's OWN known
// vocabulary. Chunks render as one connected purple piece, like a Tetris
// piece; single words render in their real deck colour. Never a scary
// total — just "Today: N boards · ~M min".
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { loadDeckIndex } from "@/lib/vocab";
import { loadSession, type SentenceLabBoard } from "@/lib/sentenceLabBoard";
import { checkAnswer } from "@/lib/sentenceLabCheck";
import { WordBlock, type BlockSkin } from "@/components/blocks/WordBlock";
import { ChameleonReaction } from "@/components/ChameleonReaction";
import { LineBlastOverlay, type BlastPraise, type BlastFloatXp } from "@/components/LineBlastOverlay";
import {
  PRAISE, COMBO_CAP, floatXpText, confettiCountForCombo,
  makeConfettiBurst, prefersReducedMotion,
} from "@/lib/lineBlast";

const FREE_BOARDS_PER_DAY = 1;
const PRO_SESSION_SIZE = 5;
const todayKey = () => new Date().toISOString().slice(0, 10);
const FREE_TASTE_KEY = "ls_sentence_lab_free_taste";

type Phase = "loading" | "empty" | "playing" | "done" | "locked";

export default function SentenceLab() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { learningLanguage } = useLanguage();
  const { isPro, loading: subLoading } = useSubscription();

  const [phase, setPhase] = useState<Phase>("loading");
  const [boards, setBoards] = useState<SentenceLabBoard[]>([]);
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(0);
  const [solved, setSolved] = useState(false);

  // Drag state — same pointer-driven pattern as GapFillChallenge: position is
  // written straight to the element's transform, never through React state,
  // so the block tracks the finger with no render lag.
  const [drag, setDrag] = useState<{ word: string; skin: BlockSkin } | null>(null);
  const [wrongWord, setWrongWord] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const dragElRef = useRef<HTMLDivElement>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const dragSizeRef = useRef({ width: 0, height: 0 });
  const activePointerRef = useRef<number | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  // Celebration — the exact primitives the landing demo and player share.
  const [praise, setPraise] = useState<BlastPraise | null>(null);
  const [floatXp, setFloatXp] = useState<BlastFloatXp | null>(null);
  const [glowKey, setGlowKey] = useState(0);
  const [reaction, setReaction] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef(makeConfettiBurst(null));
  const keyRef = useRef(0);

  useEffect(() => {
    burstRef.current = makeConfettiBurst(canvasRef.current);
  }, []);

  useEffect(() => {
    if (authLoading || subLoading) return;
    if (!user) { navigate("/auth?next=/linguascript"); return; }

    // Free users get one board a day as a taste, not the full session.
    if (!isPro) {
      const seenToday = (() => {
        try { return localStorage.getItem(FREE_TASTE_KEY) === todayKey(); } catch { return false; }
      })();
      if (seenToday) { setPhase("locked"); return; }
    }

    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("cef_level")
        .eq("user_id", user.id)
        .maybeSingle();
      const cefLevel = ((profile as any)?.cef_level as string) || "a1";

      const deck = await loadDeckIndex(user.id, learningLanguage);
      const size = isPro ? PRO_SESSION_SIZE : FREE_BOARDS_PER_DAY;
      const session = await loadSession(user.id, learningLanguage, cefLevel, deck, size);
      if (cancelled) return;
      if (session.length === 0) {
        setPhase("empty");
        return;
      }
      setBoards(session);
      setPhase("playing");
    })();
    return () => { cancelled = true; };
  }, [authLoading, subLoading, user, isPro, learningLanguage, navigate]);

  const board = boards[index];
  const totalMinutes = Math.max(1, Math.round(boards.length * 0.6));

  const celebrate = useCallback(
    (placedWord: string) => {
      setSolved(true);
      setDrag(null);
      setHint(null);
      const nextCombo = Math.min(combo + 1, COMBO_CAP);
      setCombo(nextCombo);
      const [big, sub] = PRAISE[nextCombo] ?? PRAISE[1];
      keyRef.current += 1;
      setPraise({ big, sub, combo: nextCombo, key: keyRef.current });
      setFloatXp({ text: floatXpText(nextCombo), key: keyRef.current });
      setGlowKey((k) => k + 1);
      if (!prefersReducedMotion()) burstRef.current.fire(confettiCountForCombo(nextCombo));
      setReaction(true);
      window.setTimeout(() => {
        setReaction(false);
        setSolved(false);
        setMisses(0);
        setRevealAnswer(false);
        if (!isPro) { try { localStorage.setItem(FREE_TASTE_KEY, todayKey()); } catch { /* ignore */ } }
        if (index < boards.length - 1) setIndex((i) => i + 1);
        else setPhase("done");
      }, 1700);
    },
    [combo, index, boards.length, isPro],
  );

  const attempt = useCallback(
    async (word: string) => {
      if (!board || solved || checking) return;

      // Exact match short-circuits without the async round trip — the common
      // case never waits on a POS lookup it doesn't need.
      if (word === board.answer) {
        celebrate(word);
        return;
      }

      setChecking(true);
      const result = await checkAnswer(board, learningLanguage, word);
      setChecking(false);
      // The board may have already moved on while the check was in flight
      // (e.g. the learner double-tapped) — never act on a stale result.
      if (boards[index]?.patternId !== board.patternId) return;

      if (result.correct) {
        celebrate(word);
        return;
      }

      // Only the combo resets — never a scarier penalty, and never shaming
      // copy. After two misses on the same board, gently reveal the answer.
      setCombo(0);
      setWrongWord(word);
      setDrag(null);
      setHint(result.hint ?? null);
      window.setTimeout(() => setWrongWord(null), 460);
      setMisses((m) => {
        const next = m + 1;
        if (next >= 2) setRevealAnswer(true);
        return next;
      });
    },
    [board, solved, checking, learningLanguage, boards, index, celebrate],
  );

  const paintDrag = useCallback(() => {
    const el = dragElRef.current;
    if (!el) return;
    const { x, y } = dragPosRef.current;
    const o = grabOffsetRef.current;
    el.style.transform = `translate3d(${x - o.x}px, ${y - o.y}px, 0)`;
  }, []);

  const startDrag = (word: string, skin: BlockSkin) => (e: React.PointerEvent) => {
    if (solved) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    grabOffsetRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    dragSizeRef.current = { width: r.width, height: r.height };
    activePointerRef.current = e.pointerId;
    dragPosRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ word, skin });
  };

  useEffect(() => {
    if (drag) paintDrag();
  }, [drag, paintDrag]);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== activePointerRef.current) return;
      dragPosRef.current = { x: e.clientX, y: e.clientY };
      paintDrag();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== activePointerRef.current) return;
      const box = slotRef.current?.getBoundingClientRect();
      const cx = e.clientX - grabOffsetRef.current.x + dragSizeRef.current.width / 2;
      const cy = e.clientY - grabOffsetRef.current.y + dragSizeRef.current.height / 2;
      const hit = box && cx >= box.left - 40 && cx <= box.right + 40 && cy >= box.top - 40 && cy <= box.bottom + 40;
      const { word } = drag;
      activePointerRef.current = null;
      if (hit) void attempt(word);
      else setDrag(null);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, attempt, paintDrag]);

  return (
    <div className="relative min-h-screen bg-[#0b1215] text-white">
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 h-full w-full" />
      <LineBlastOverlay praise={praise} floatXp={floatXp} glowKey={glowKey} placement="screen" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b1215]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-md items-center gap-3 px-4">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Sentence Lab</p>
            {phase === "playing" && (
              <p className="text-xs text-white/50">Today: {boards.length} board{boards.length !== 1 ? "s" : ""} · ~{totalMinutes} min</p>
            )}
          </div>
          {phase === "playing" && (
            <div className="flex items-center gap-1.5">
              {boards.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? "w-5 bg-[#34C759]" : i < index ? "w-2 bg-[#34C759]/60" : "w-2 bg-white/15"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        {(phase === "loading" || authLoading || subLoading) && (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        )}

        {phase === "locked" && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="text-6xl mb-4">🦎</div>
            <h1 className="text-xl font-extrabold mb-2">You've had today's free board</h1>
            <p className="text-sm text-white/60 mb-6">
              Sentence Lab is a Pro feature — free accounts get one board a day as a taste. Upgrade for the full 5-board session.
            </p>
            <button
              onClick={() => navigate("/upgrade")}
              className="rounded-2xl bg-[#34C759] px-6 py-3 font-bold text-black"
            >
              See Pro
            </button>
          </div>
        )}

        {phase === "empty" && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="text-6xl mb-4">🌱</div>
            <h1 className="text-xl font-extrabold mb-2">Not quite enough words yet</h1>
            <p className="text-sm text-white/60">
              Sentence Lab builds boards from words you already know. Save a few more from videos, then come back.
            </p>
          </div>
        )}

        {phase === "playing" && board && (
          <div className="flex flex-col items-center">
            {/* The frame + gap. The frame is one connected purple piece when it's
                a chunk (more than one word) — never separate word-by-word tiles,
                so "j'ai besoin de" reads as a single unit, not three words. */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
              {board.frame && (
                <WordBlock label={board.frame} skin="purple" draggable={false} size="md" />
              )}
              <div
                ref={slotRef}
                className="flex min-h-[52px] min-w-[92px] items-center justify-center rounded-2xl border-2 border-dashed px-4 transition-colors"
                style={{
                  borderColor: solved ? "transparent" : "rgba(255,255,255,0.28)",
                  background: solved ? "transparent" : "rgba(255,255,255,0.04)",
                  animation: solved ? undefined : "sl-slot-pulse 1.8s ease-in-out infinite",
                }}
              >
                {solved && (
                  <WordBlock
                    label={board.answer}
                    skin={board.answerSkin}
                    draggable={false}
                    style={{ animation: "sl-pop 320ms cubic-bezier(0.16,1,0.3,1)" }}
                  />
                )}
              </div>
              {board.after && (
                <WordBlock label={board.after} skin="purple" draggable={false} size="md" />
              )}
            </div>

            {board.translation && (
              <p className="mb-2 text-sm italic text-white/40">{board.translation}</p>
            )}

            {/* Wrong-answer hint — always says what went wrong, never a
                generic "try a verb". Clears the moment the board is solved. */}
            {hint && !solved && (
              <p className="mb-4 max-w-xs text-center text-sm font-medium text-[#FF8A00]">{hint}</p>
            )}
            {checking && (
              <p className="mb-4 flex items-center gap-1.5 text-xs text-white/40">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking…
              </p>
            )}

            {combo > 1 && (
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#34C759]">
                Combo ×{combo}
              </p>
            )}

            <style>{`
              @keyframes sl-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
              @keyframes sl-pop { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
              @keyframes sl-slot-pulse { 0%,100%{border-color:rgba(255,255,255,0.28)} 50%{border-color:rgba(255,255,255,0.55)} }
              @keyframes sl-reveal { 0%,100%{opacity:0.4} 50%{opacity:1} }
            `}</style>

            {/* Block tray */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {board.candidates.map((c) => {
                const isAnswer = c.word === board.answer;
                return (
                  <div
                    key={c.word}
                    className="rounded-2xl"
                    style={
                      revealAnswer && isAnswer && !solved
                        ? {
                            boxShadow: "0 0 0 3px #22D3EE, 0 0 18px 4px rgba(34,211,238,0.65)",
                            animation: "sl-reveal 1.1s ease-in-out infinite",
                          }
                        : undefined
                    }
                  >
                    <WordBlock
                      label={c.word}
                      skin={isAnswer && solved ? "green" : c.skin}
                      dragging={drag?.word === c.word}
                      onPointerDown={startDrag(c.word, c.skin)}
                      onDoubleClick={() => void attempt(c.word)}
                      style={{
                        opacity: solved && !isAnswer ? 0.25 : drag?.word === c.word ? 0.35 : 1,
                        animation: wrongWord === c.word ? "sl-shake 420ms ease-in-out" : undefined,
                        pointerEvents: solved || checking ? "none" : undefined,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {reaction && (
              <div className="relative w-full">
                <ChameleonReaction mode="orange-to-green" onDone={() => setReaction(false)} />
              </div>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-xl font-extrabold mb-2">Session complete</h1>
            <p className="text-sm text-white/60 mb-6">
              {boards.length} sentence{boards.length !== 1 ? "s" : ""} built. Nice work — see you tomorrow.
            </p>
            <button
              onClick={() => navigate("/discover")}
              className="rounded-2xl bg-[#34C759] px-6 py-3 font-bold text-black"
            >
              Back to Discover
            </button>
          </div>
        )}
      </main>

      {drag && createPortal(
        <div
          ref={dragElRef}
          className="pointer-events-none fixed left-0 top-0 z-[100] will-change-transform"
          style={{ width: dragSizeRef.current.width }}
        >
          <WordBlock label={drag.word} skin={drag.skin} dragging />
        </div>,
        document.body,
      )}
    </div>
  );
}
