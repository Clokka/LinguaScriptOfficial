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
  /** Due date for the next review — used to gate the in-video gap challenge. */
  next_review?: string | null;
  /** When the deck state last changed — the Golden Reveal compares against it. */
  state_changed_at?: string | null;
  created_at?: string | null;
  /**
   * When the learner claimed this word's promotion to green.
   *
   * Absent (not null) when the Golden Reveal migration hasn't run — see
   * `isPendingGreen`, which relies on that distinction.
   */
  green_revealed_at?: string | null;
  /** Lines this word has appeared in while gold, for the auto-reveal decay. */
  gold_seen_count?: number | null;
}

export const STATE_META: Record<DeckState, {
  label: string;
  dot: string;
  bg: string;
  ring: string;
  text: string;
  border: string;
}> = {
  // Deck colours are the landing palette at full strength — #FF3B30 / #FF8A00 /
  // #34C759 — never washed out, because they are the product's only real
  // information channel.
  red: {
    label: "Unknown",
    dot: "bg-[#FF3B30]",
    bg: "bg-[#FF3B30]/15",
    ring: "ring-[#FF3B30]",
    text: "text-[#FF3B30]",
    border: "border-[#FF3B30]/60",
  },
  orange: {
    label: "Learning",
    dot: "bg-[#FF8A00]",
    bg: "bg-[#FF8A00]/15",
    ring: "ring-[#FF8A00]",
    text: "text-[#FF8A00]",
    border: "border-[#FF8A00]/60",
  },
  green: {
    label: "Recognized",
    dot: "bg-[#34C759]",
    bg: "bg-[#34C759]/15",
    ring: "ring-[#34C759]",
    text: "text-[#34C759]",
    border: "border-[#34C759]/60",
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

/**
 * Columns every deck read needs. If one of these is missing the app is broken
 * anyway, so there is no point degrading — let the error surface.
 */
const DECK_BASE_COLUMNS =
  "id, word, language, state, times_correct, review_count, next_review, state_changed_at, created_at";

/**
 * Columns the Golden Reveal adds. These live behind a migration, so a database
 * that hasn't run it yet must still serve colours.
 */
const DECK_GOLD_COLUMNS = "green_revealed_at, gold_seen_count";

/**
 * Whether the Golden Reveal columns exist in this database.
 *
 * PostgREST rejects the *entire* query when a selected column is missing — one
 * unknown name and every word loses its deck state, so the whole red/orange/
 * green system goes dark. Rather than couple subtitle colouring to a migration
 * having been applied, we probe once and remember the answer: gold lights up on
 * its own the first time the deck is read after the migration lands, and until
 * then the three real decks are unaffected.
 *
 * `null` = not yet probed.
 */
let goldColumnsAvailable: boolean | null = null;

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

  const fetchPage = (withGold: boolean) =>
    supabase
      .from("saved_words")
      .select(withGold ? `${DECK_BASE_COLUMNS}, ${DECK_GOLD_COLUMNS}` : DECK_BASE_COLUMNS)
      .eq("user_id", userId)
      .eq("language", language)
      .range(from, from + pageSize - 1);

  while (true) {
    const wantGold = goldColumnsAvailable !== false;
    let { data, error } = await fetchPage(wantGold);

    if (error && wantGold) {
      // Most likely the Golden Reveal migration hasn't run here. Drop the gold
      // columns and retry — colours matter more than the reward layer.
      console.warn("[loadDeckIndex] retrying without Golden Reveal columns", error);
      const fallback = await fetchPage(false);
      // Only latch when the retry *succeeds*: the same query minus two columns
      // coming back clean is good evidence the schema is behind, whereas a
      // network blip would have taken both attempts down and must not
      // permanently disable gold for the session.
      if (!fallback.error) goldColumnsAvailable = false;
      ({ data, error } = fallback);
    } else if (!error && wantGold) {
      goldColumnsAvailable = true;
    }

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
