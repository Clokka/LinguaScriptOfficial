import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMBO_CAP,
  PRAISE,
  floatXpText,
  confettiCountForCombo,
  prefersReducedMotion,
  makeConfettiBurst,
  type ConfettiBurst,
} from "@/lib/lineBlast";
import { greenScoreForLine } from "@/lib/understanding";
import { loadDeckIndex, normalizeToken, type SavedWordLite } from "@/lib/vocab";
import { useXp } from "@/contexts/XpContext";
import { useAuth } from "@/hooks/useAuth";
import type { BlastFloatXp, BlastPraise } from "@/components/LineBlastOverlay";

/**
 * The Line Blast, and the single rule for when it is allowed to fire.
 *
 * The blast means one thing: **a line just turned fully green**. Not a card
 * advanced, not an answer was right, not a stage was cleared. Firing it on
 * ordinary progress is the fastest way to make it worthless — a celebration
 * that happens on every interaction stops reading as a celebration at all, and
 * the moment it is supposed to protect is the rare one where an entire
 * sentence becomes comprehensible.
 *
 * It is also a *transition*, not a state. A line that was already fully green
 * when the learner met it has nothing to celebrate — they did not just make it
 * green, they merely encountered something they already knew. Only the crossing
 * counts, and only when the learner caused it. That is why a line must be armed
 * while it is still incomplete before it is allowed to blast: without that,
 * every already-known sentence would fire on sight.
 *
 * The player already enforced this via greenScoreForLine and its is-this-the-
 * last-non-green check. This hook exists so the LinguaScript surfaces enforce
 * it the same way rather than inventing their own trigger, which is exactly how
 * the four drifted copies of the effect happened in the first place.
 */

interface UseLineBlastOptions {
  /** Language of the lines being checked — drives function-word weighting. */
  language: string;
}

export interface LineBlast {
  praise: BlastPraise | null;
  floatXp: BlastFloatXp | null;
  glowKey: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /**
   * Record that a word just reached the green deck, so the next line check
   * sees it without waiting for a round trip.
   */
  markGreen: (word: string) => void;
  /**
   * Record a line's state before the learner acts on it. A line is only ever
   * allowed to blast if it was still incomplete at this moment, so call it when
   * the line is presented — not after an answer.
   */
  armLine: (text: string) => void;
  /**
   * Fire the blast if this line has just crossed into fully green. Returns
   * whether it fired, so callers can branch on the big moment. Silent when the
   * line was already complete when armed, or has blasted before.
   */
  completeLine: (text: string) => boolean;
  /** A miss or a skip ends the streak, exactly as a passed-over line does. */
  breakCombo: () => void;
  /** True once the deck has loaded; before that no line can be judged green. */
  ready: boolean;
}

export function useLineBlast({ language }: UseLineBlastOptions): LineBlast {
  const { user } = useAuth();
  const { award } = useXp();

  const [praise, setPraise] = useState<BlastPraise | null>(null);
  const [floatXp, setFloatXp] = useState<BlastFloatXp | null>(null);
  const [glowKey, setGlowKey] = useState(0);
  const [ready, setReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<ConfettiBurst | null>(null);
  const timersRef = useRef<number[]>([]);
  const comboRef = useRef(0);
  const deckRef = useRef<Map<string, SavedWordLite>>(new Map());
  /** Lines already blasted, so a re-render or a revisit can't fire twice. */
  const blastedRef = useRef<Set<string>>(new Set());
  /** Lines seen while still incomplete — the only ones eligible to blast. */
  const armedRef = useRef<Set<string>>(new Set());
  /** Lines seen at all, so arming is judged once and not re-judged after. */
  const seenRef = useRef<Set<string>>(new Set());

  // Loaded once. Promotions during the session are applied locally through
  // markGreen — re-reading the whole deck after every answer would mean a
  // paged query per interaction for a table that runs to thousands of rows.
  useEffect(() => {
    let alive = true;
    void loadDeckIndex(user?.id ?? null, language).then((deck) => {
      if (!alive) return;
      deckRef.current = deck;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, language]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      confettiRef.current?.reset();
    },
    [],
  );

  const markGreen = useCallback((word: string) => {
    const key = normalizeToken(word);
    if (!key) return;
    const existing = deckRef.current.get(key);
    deckRef.current.set(key, {
      ...(existing ?? {
        id: `local-${key}`,
        word,
        language,
        times_correct: 0,
        review_count: 0,
      }),
      state: "green",
    } as SavedWordLite);
  }, [language]);

  const fire = useCallback(() => {
    const reduced = prefersReducedMotion();
    comboRef.current = Math.min(comboRef.current + 1, COMBO_CAP);
    const combo = comboRef.current;

    const [big, sub] = PRAISE[combo];
    setPraise({ big, sub, combo, key: Date.now() });
    setFloatXp({ text: floatXpText(combo), key: Date.now() });

    // One grant per combo step, so the label and the balance agree.
    for (let i = 0; i < combo; i++) award("line_blast");

    if (combo >= 2 && !reduced) {
      if (!confettiRef.current) {
        confettiRef.current = makeConfettiBurst(canvasRef.current);
      }
      confettiRef.current.fire(confettiCountForCombo(combo));
      setGlowKey(Date.now());
    }

    timersRef.current.push(
      window.setTimeout(() => {
        setPraise(null);
        setFloatXp(null);
      }, reduced ? 1500 : 2100),
    );
  }, [award]);

  const armLine = useCallback(
    (text: string) => {
      const line = text?.trim();
      // Judging before the deck exists would score every line 0% and arm the
      // ones the learner already knows — the exact false positive this guards.
      if (!line || !ready || seenRef.current.has(line)) return;
      seenRef.current.add(line);

      const score = greenScoreForLine(line, language, deckRef.current);
      if (score.totalCount > 0 && score.pct < 100) armedRef.current.add(line);
    },
    [language, ready],
  );

  const completeLine = useCallback(
    (text: string) => {
      const line = text?.trim();
      if (!line || blastedRef.current.has(line)) return false;
      // Not armed means it was already green when the learner met it. Nothing
      // was achieved just now, so nothing is celebrated.
      if (!armedRef.current.has(line)) return false;

      const score = greenScoreForLine(line, language, deckRef.current);
      // totalCount guards against a line of pure punctuation scoring 0/0 = 100.
      if (score.totalCount === 0 || score.pct < 100) return false;

      blastedRef.current.add(line);
      armedRef.current.delete(line);
      fire();
      return true;
    },
    [fire, language],
  );

  const breakCombo = useCallback(() => {
    comboRef.current = 0;
  }, []);

  return {
    praise,
    floatXp,
    glowKey,
    canvasRef,
    markGreen,
    armLine,
    completeLine,
    breakCombo,
    ready,
  };
}
