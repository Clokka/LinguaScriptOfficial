// Red → Orange → Green deck system, driven entirely by the user's saved_words.
//
// Every saved word IS in one of three decks (red = just saved / unknown,
// orange = learning, green = known). Subtitles colour words by matching the
// rendered token against the user's saved_words map. Words that aren't saved
// render in the default subtitle colour ("unassessed").
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
    label: "Unknown",
    dot: "bg-red-500",
    bg: "bg-red-500/10",
    ring: "ring-red-500/40",
    text: "text-red-500",
    border: "border-red-500/40",
  },
  orange: {
    label: "Learning",
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    text: "text-amber-500",
    border: "border-amber-500/40",
  },
  green: {
    label: "Recognized",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/40",
    text: "text-emerald-500",
    border: "border-emerald-500/40",
  },
};

/** Coerce a stored state string into a valid DeckState (defaults to red). */
export const coerceDeckState = (raw: string | null | undefined): DeckState =>
  raw === "green" ? "green" : raw === "orange" ? "orange" : "red";

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
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("saved_words")
      .select("id, word, language, state, times_correct, review_count")
      .eq("user_id", userId)
      .eq("language", language)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("loadDeckIndex", error);
      return m;
    }
    const batch = (data as any[]) || [];
    for (const row of batch) {
      m.set(normalizeToken(row.word), { ...row, state: coerceDeckState(row.state) } as SavedWordLite);
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return m;
}

/**
 * Forward-only progression: cards NEVER move backwards.
 *  - Correct:   red→orange, orange→green, green stays.
 *  - Incorrect: card stays in its current deck (no demotion).
 *
 * LinguaScript mission: Turn the Language Green. Every successful interaction
 * is forward progress; a single forgotten word never undoes prior effort.
 */
export function nextState(
  current: DeckState,
  _timesCorrectAfter: number,
  correct: boolean,
): DeckState {
  if (!correct) return current;
  if (current === "red") return "orange";
  if (current === "orange") return "green";
  return "green";
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
