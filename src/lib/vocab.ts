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
 *
 * This colour is a motivational layer, kept deliberately separate from the
 * real review schedule below (`applySrsReview`) — a lapse reschedules the
 * card sooner without taking away the green badge the learner already earned.
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

const STATE_RANK: Record<DeckState, number> = { red: 0, orange: 1, green: 2 };

/** The higher of two states, forward-only style — never demotes. */
export function maxState(a: DeckState, b: DeckState): DeckState {
  return STATE_RANK[a] >= STATE_RANK[b] ? a : b;
}

/**
 * Propagate a deck-state promotion across every saved word sharing the same
 * lemma. "manges", "mangeons" and "mangerons" are all the verb "manger" —
 * they should be tracked as one piece of knowledge, not three unrelated
 * vocabulary items that happen to look similar. Mastering (or reviewing) any
 * one of them brings every other saved conjugation of the same lemma up to
 * the group's current best state.
 *
 * Only syncs across words the learner has already individually saved —
 * it does not retroactively recognise an unsaved conjugation appearing in a
 * video (that needs lemmatizing the video's own captions, a separate,
 * heavier feature).
 *
 * Forward-only, matching `nextState()`: a row only ever moves up to the
 * group's target, never down.
 */
export async function syncLemmaState(
  userId: string,
  language: string,
  lemma: string,
  reviewedId: string,
  reviewedNewState: DeckState,
): Promise<{ target: DeckState; updatedIds: string[] } | null> {
  if (!lemma.trim()) return null;

  const { data, error } = await supabase
    .from("saved_words")
    .select("id, state")
    .eq("user_id", userId)
    .eq("language", language)
    .ilike("lemma", lemma);
  if (error || !data || data.length === 0) return null;

  let target = reviewedNewState;
  for (const row of data) {
    if (row.id === reviewedId) continue;
    target = maxState(target, coerceDeckState(row.state));
  }

  const updatedIds = data
    .filter((row) => STATE_RANK[coerceDeckState(row.state)] < STATE_RANK[target])
    .map((row) => row.id);
  // Include the just-reviewed row itself if the group's target ended up
  // higher than what its own review would have produced alone.
  if (STATE_RANK[reviewedNewState] < STATE_RANK[target]) updatedIds.push(reviewedId);
  if (updatedIds.length === 0) return { target, updatedIds: [] };

  const { error: updateError } = await supabase
    .from("saved_words")
    .update({ state: target, state_changed_at: new Date().toISOString() })
    .in("id", updatedIds);
  if (updateError) {
    console.error("[syncLemmaState] failed to promote sibling forms", updateError);
    return null;
  }
  return { target, updatedIds };
}

/**
 * When saving a brand-new word, check whether the learner already knows
 * another conjugation of the same lemma — a freshly-clicked "mangeons"
 * should start out green immediately if "manger" is already mastered via
 * "manges", not restart at red as if it were an unrelated word.
 */
export async function bestStateForLemma(
  userId: string,
  language: string,
  lemma: string,
): Promise<DeckState | null> {
  if (!lemma.trim()) return null;
  const { data, error } = await supabase
    .from("saved_words")
    .select("state")
    .eq("user_id", userId)
    .eq("language", language)
    .ilike("lemma", lemma);
  if (error || !data || data.length === 0) return null;
  return data.reduce<DeckState>((acc, row) => maxState(acc, coerceDeckState(row.state)), "red");
}

/** The saved_words columns a real review cycle needs to read and rewrite. */
export interface SrsInput {
  ease_factor?: number | null;
  interval_days?: number | null;
  review_count?: number | null;
}

export interface SrsResult {
  ease_factor: number;
  interval_days: number;
  review_count: number;
  /** `saved_words.next_review` is a `date` column (YYYY-MM-DD). */
  next_review: string;
  last_reviewed_at: string;
  last_correct_at?: string;
}

/**
 * A simplified SM-2: the same algorithm Anki's default scheduler is built
 * on, adapted for a binary correct/incorrect grade instead of a 0-5 quality
 * score.
 *
 *  - Incorrect ("Again"): interval resets to 1 day and the ease factor dips
 *    slightly (floor 1.3), so a forgotten word resurfaces tomorrow instead
 *    of drifting back onto whatever interval it was previously on.
 *  - Correct: interval grows 1 → 6 → previous×ease, and the ease factor
 *    nudges up — successive correct answers space reviews further apart,
 *    which is the entire point of spaced repetition and the thing the old
 *    no-op `recordReview` never did.
 *
 * Deliberately does not touch `state` (red/orange/green) — see `nextState`.
 */
export function applySrsReview(current: SrsInput, correct: boolean): SrsResult {
  const prevEase = current.ease_factor ?? 2.5;
  const prevInterval = current.interval_days ?? 1;
  const prevReviewCount = current.review_count ?? 0;
  const now = new Date();
  const nowIso = now.toISOString();

  let easeFactor: number;
  let intervalDays: number;
  let reviewCount: number;

  if (!correct) {
    easeFactor = Math.max(1.3, prevEase - 0.2);
    intervalDays = 1;
    reviewCount = 0;
  } else {
    easeFactor = Math.max(1.3, Math.min(3.0, prevEase + 0.1));
    reviewCount = prevReviewCount + 1;
    if (reviewCount === 1) intervalDays = 1;
    else if (reviewCount === 2) intervalDays = 6;
    else intervalDays = Math.round(prevInterval * easeFactor);
  }

  const nextReview = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    ease_factor: easeFactor,
    interval_days: intervalDays,
    review_count: reviewCount,
    next_review: nextReview.toISOString().split("T")[0],
    last_reviewed_at: nowIso,
    ...(correct ? { last_correct_at: nowIso } : {}),
  };
}
