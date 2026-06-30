/**
 * useUpgradeTrigger — fires navigate('/upgrade') at the moments of maximum
 * emotional investment, based on the Hook Model (Nir Eyal) and Huberman's
 * variable reward research.
 *
 * Trigger moments (ordered by conversion likelihood):
 *  1. daily_limit   — free user hits 10-word daily save cap. Pain is most
 *                     acute here; the wall appears at peak desire.
 *  2. third_word    — 3rd word saved in a session. Enough investment to feel
 *                     the product working; not so early it feels like a forced ad.
 *  3. first_video   — WatchResultsModal opens after the very first video.
 *                     Peak accomplishment + open loop ("will I improve next time?").
 *  4. xp_milestone  — XP crosses a round number (50, 100, 250…). Positive
 *                     emotion transfers directly to the upgrade CTA.
 *
 * Each trigger fires AT MOST ONCE PER DAY per reason, stored in localStorage.
 * A shown trigger is suppressed for 24 hours to avoid nagging.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export type UpgradeTriggerReason =
  | 'daily_limit'
  | 'third_word'
  | 'first_video'
  | 'xp_milestone';

const FREE_DAILY_SAVE_LIMIT = 10;
const STORAGE_KEY = 'ls_upgrade_trigger';
const DAY_MS = 86_400_000;

interface StoredTriggers {
  [reason: string]: number; // timestamp of last fire
}

function loadStored(): StoredTriggers {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function markShown(reason: UpgradeTriggerReason) {
  const stored = loadStored();
  stored[reason] = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function wasShownToday(reason: UpgradeTriggerReason): boolean {
  const stored = loadStored();
  const last = stored[reason];
  if (!last) return false;
  return Date.now() - last < DAY_MS;
}

// ── Session word counter (in-memory, resets on page load) ────────
let sessionWordCount = 0;

export function incrementSessionWordCount() {
  sessionWordCount += 1;
  return sessionWordCount;
}

export function resetSessionWordCount() {
  sessionWordCount = 0;
}

// ── Hook ─────────────────────────────────────────────────────────
export function useUpgradeTrigger(isPro: boolean) {
  const navigate = useNavigate();

  const fire = useCallback((reason: UpgradeTriggerReason) => {
    if (isPro) return;                   // already subscribed — never interrupt
    if (wasShownToday(reason)) return;   // already nagged today for this reason
    markShown(reason);
    navigate('/upgrade', { state: { reason } }); // pass reason for analytics
  }, [isPro, navigate]);

  /**
   * Call after every successful word save.
   * @param totalSavedToday  — total words saved today (from DB or local count)
   */
  const onWordSaved = useCallback((totalSavedToday: number) => {
    if (isPro) return;

    // Priority 1: daily limit wall (most painful = highest conversion)
    if (totalSavedToday >= FREE_DAILY_SAVE_LIMIT) {
      fire('daily_limit');
      return;
    }

    // Priority 2: 3rd word saved this session
    const count = incrementSessionWordCount();
    if (count === 3) {
      fire('third_word');
    }
  }, [isPro, fire]);

  /**
   * Call when WatchResultsModal opens.
   * @param isFirstWatch  — true if this is the user's first ever watch of this film
   */
  const onVideoFinished = useCallback((isFirstWatch: boolean) => {
    if (isFirstWatch) fire('first_video');
  }, [fire]);

  /**
   * Call after awarding XP. Pass the new total XP.
   * Fires on round milestones: 50, 100, 250, 500, 1000…
   */
  const onXpAwarded = useCallback((newTotal: number) => {
    const milestones = [50, 100, 250, 500, 1000, 2500, 5000];
    const hit = milestones.some(m => {
      // crossed the milestone this award (previous total was below it)
      const prev = newTotal - 1; // rough; exact diff not available here
      return prev < m && newTotal >= m;
    });
    if (hit) fire('xp_milestone');
  }, [fire]);

  return { onWordSaved, onVideoFinished, onXpAwarded };
}
