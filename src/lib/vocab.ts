// Red → Orange → Green deck system, driven entirely by the user's saved_words.
//
// Decks are not a separate catalogue — every saved word IS in one of three decks
// (red = new, orange = learning, green = learned). Subtitles colour words by
// matching the rendered token against the user's saved_words map.
import { supabase } from "@/integrations/supabase/client";
import { getGuestWords } from "@/lib/guestWords";

export type DeckState = "red" | "orange" | "green";

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
  red: {
    label: "Red",
    dot: "bg-red-500",
    bg: "bg-red-500/10",
    ring: "ring-red-500/40",
    text: "text-red-500",
    border: "border-red-500/40",
  },
  orange: {
    label: "Orange",
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    text: "text-amber-500",
    border: "border-amber-500/40",
  },
  green: {
    label: "Green",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/40",
    text: "text-emerald-500",
    border: "border-emerald-500/40",
  },
};

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
        state: "red",
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
  for (const row of (data as SavedWordLite[]) || []) {
    m.set(normalizeToken(row.word), row);
  }
  return m;
}

/**
 * Compute the next deck state from a flashcard outcome.
 *  - Correct:   red→orange, orange→green after 3 cumulative correct, green stays.
 *  - Incorrect: green→orange, orange→red, red stays.
 */
export function nextState(
  current: DeckState,
  _timesCorrectAfter: number,
  correct: boolean,
): DeckState {
  if (correct) {
    if (current === "green") return "green";
    if (current === "red") return "orange";
    return "green"; // orange → green on a correct recall
  }
  if (current === "green") return "orange";
  if (current === "orange") return "red";
  return "red";
}

/** Apply a flashcard outcome to a saved word row. */
export async function recordReview(
  savedWordId: string,
  current: DeckState,
  currentTimesCorrect: number,
  correct: boolean,
): Promise<DeckState> {
  const timesCorrect = currentTimesCorrect + (correct ? 1 : 0);
  const next = nextState(current, timesCorrect, correct);
  const patch: Record<string, unknown> = {
    state: next,
    times_correct: timesCorrect,
  };
  if (next !== current) patch.state_changed_at = new Date().toISOString();
  const { error, data } = await supabase
    .from("saved_words")
    .update(patch as any)
    .eq("id", savedWordId)
    .select("id, state, times_correct");
  if (error) console.error("[recordReview] update failed", error);
  else if (!data || data.length === 0) {
    console.error("[recordReview] update affected 0 rows for id", savedWordId, "— row missing or RLS denied");
  } else {
    console.log("[recordReview] ok", savedWordId, current, "→", next);
  }
  return next;
}
