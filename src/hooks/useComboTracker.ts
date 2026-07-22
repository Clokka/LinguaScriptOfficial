/**
 * Tracks consecutive correct answers for LinguaScripts
 * Combo multiplier increases from 1→5 with each consecutive correct
 * Resets after 30 minutes of inactivity or 8 skips
 */

import { useState, useCallback, useRef, useEffect } from "react";

const COMBO_MAX = 5;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SKIP_DECAY_THRESHOLD = 8;

export function useComboTracker() {
  const [combo, setCombo] = useState(1);
  const [skips, setSkips] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Set inactivity timeout
  const scheduleReset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setCombo(1);
      setSkips(0);
    }, INACTIVITY_TIMEOUT);
  }, []);

  // Record correct answer
  const recordCorrect = useCallback(() => {
    setCombo((prev) => Math.min(prev + 1, COMBO_MAX));
    setSkips(0);
    scheduleReset();
  }, [scheduleReset]);

  // Record incorrect answer
  const recordIncorrect = useCallback(() => {
    scheduleReset();
  }, [scheduleReset]);

  // Record skip (counts toward decay)
  const recordSkip = useCallback(() => {
    setSkips((prev) => {
      const newSkips = prev + 1;
      if (newSkips >= SKIP_DECAY_THRESHOLD) {
        setCombo(1);
        return 0;
      }
      return newSkips;
    });
    scheduleReset();
  }, [scheduleReset]);

  // Manual reset
  const reset = useCallback(() => {
    setCombo(1);
    setSkips(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return {
    combo,
    skips,
    recordCorrect,
    recordIncorrect,
    recordSkip,
    reset,
  };
}
