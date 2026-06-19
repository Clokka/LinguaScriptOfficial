// Vocabulary state model:
//   ⚪ Unassessed = NOT in the user's saved_words (default for any token).
//   🟠 Learning   = saved_words.state === 'orange' (actively reviewing).
//   🟢 Known      = saved_words.state === 'green'  (acquired).
//
// Legacy rows with state='red' are treated as 'orange' on read.
import { supabase } from "@/integrations/supabase/client";
import { getGuestWords } from "@/lib/guestWords";

export type DeckState = "orange" | "green";

export interface SavedWordLite {
  id: string;
  word: string;
  language: string;
  state: DeckState;
  times_correct: number;
  review_count: number;
}

export const STATE_META: Record<DeckState, {
  label: string;
  dot: string;
  bg: string;
  ring: string;
  text: string;
  border: string;
}> = {
  orange: {
    label: "Learning",
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    text: "text-amber-500",
    border: "border-amber-500/40",
  },
  green: {
    label: "Known",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/40",
    text: "text-emerald-500",
    border: "border-emerald-500/40",
  },
};

/** Normalise any state string from storage (legacy 'red' → 'orange'). */
export const coerceDeckState = (raw: string | null | undefined): DeckState =>
  raw === "green" ? "green" : "orange";

/** Normalise a token to its match key (lowercase, strip punctuation). */
export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…]/g, "")
    .trim();
}

/** Load saved words for a user (or guest) keyed by normalised word + language. */
export async function loadDeckIndex(
  userId: string | null,
  language: string,
): Promise<Map<string, SavedWordLite>> {
  const m = new Map<string, SavedWordLite>();
  if (!userId) {
    for (const g of getGuestWords()) {
      if (g.language !== language) continue;
      m.set(normalizeToken(g.word), {
        id: g.id,
        word: g.word,
        language: g.language,
        state: "orange",
        times_correct: 0,
        review_count: g.review_count,
      });
    }
    return m;
  }
  const { data, error } = await supabase
    .from("saved_words")
    .select("id, word, language, state, times_correct, review_count")
    .eq("user_id", userId)
    .eq("language", language);
  if (error) {
    console.error("loadDeckIndex", error);
    return m;
  }
  for (const row of (data as any[]) || []) {
    m.set(normalizeToken(row.word), { ...row, state: coerceDeckState(row.state) } as SavedWordLite);
  }
  return m;
}

/**
 * Compute the next deck state from a flashcard outcome.
 *  - Correct:   orange → green, green stays.
 *  - Incorrect: green  → orange, orange stays (learners aren't punished back to nothing).
 */
export function nextState(
  current: DeckState,
  _timesCorrectAfter: number,
  correct: boolean,
): DeckState {
  if (correct) return "green";
  if (current === "green") return "orange";
  return "orange";
}

/** Log a flashcard review without controlling SRS deck transitions. */
export async function recordReview(
  savedWordId: string,
  current: DeckState,
  _currentTimesCorrect: number,
  _correct: boolean,
): Promise<DeckState> {
  console.debug("[recordReview] analytics-only no-op", savedWordId);
  return current;
}
