import type { LinguaScriptSupabaseClient } from './supabase';
import { coerceDeckState, promote, dateInDays, nextReviewInterval, normalizeToken, type DeckState } from './review';

// Database helpers for the deck. The rules themselves (ladder, gold, colours)
// live in ./review.ts, shared with the website.

export interface SavedWordLite {
  id: string;
  word: string;
  language: string;
  state: DeckState;
  times_correct: number;
  review_count: number;
  next_review?: string | null;
  interval_days?: number | null;
  state_changed_at?: string | null;
  /** Tapped in a video since the review fell due (gold → green on screen). */
  green_revealed_at?: string | null;
}

/**
 * Forward-only progression: cards NEVER move backwards.
 *  - Correct:   red→orange, orange→green, green stays.
 *  - Incorrect: card stays in its current deck (no demotion).
 */
export function nextState(current: DeckState, correct: boolean): DeckState {
  return promote(current, correct);
}

/** Load saved words keyed by normalised word. */
export async function loadDeckIndex(
  client: LinguaScriptSupabaseClient,
  userId: string,
  language: string,
): Promise<Map<string, SavedWordLite>> {
  const m = new Map<string, SavedWordLite>();
  const pageSize = 1000;
  let from = 0;
  const base = 'id, word, language, state, times_correct, review_count, next_review, interval_days, state_changed_at';
  // green_revealed_at comes from a later migration; without it gold can't
  // tell "tapped" words apart, but colours must still load.
  let withReveal = true;
  while (true) {
    let { data, error } = await client
      .from('saved_words')
      .select(withReveal ? `${base}, green_revealed_at` : base)
      .eq('user_id', userId)
      .eq('language', language)
      .range(from, from + pageSize - 1);
    if (error && withReveal) {
      withReveal = false;
      continue;
    }
    if (error) {
      console.error('loadDeckIndex', error);
      return m;
    }
    const batch = (data as any[]) || [];
    for (const row of batch) {
      m.set(normalizeToken(row.word), {
        ...row,
        state: coerceDeckState(row.state),
      } as SavedWordLite);
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return m;
}

/** Load flashcards due for review (next_review in the past or null). */
export async function loadDueCards(
  client: LinguaScriptSupabaseClient,
  userId: string,
  language: string,
  limit = 30,
): Promise<SavedWordLite[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from('saved_words')
    .select('id, word, language, state, times_correct, review_count, next_review, interval_days, state_changed_at, green_revealed_at, translation')
    .eq('user_id', userId)
    .eq('language', language)
    .or(`next_review.lte.${nowIso},next_review.is.null`)
    .order('next_review', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) {
    console.error('loadDueCards', error);
    return [];
  }
  return ((data as any[]) || []).map((r) => ({
    ...r,
    state: coerceDeckState(r.state),
  })) as SavedWordLite[];
}

/** Record a review + advance deck state + schedule the next review on the ladder. */
export async function submitReview(
  client: LinguaScriptSupabaseClient,
  card: SavedWordLite,
  correct: boolean,
): Promise<DeckState> {
  const newState = nextState(card.state, correct);
  const interval_days = nextReviewInterval(card.interval_days, correct, card.state === 'green', newState === 'green');
  const next_review = dateInDays(interval_days);
  const times_correct = card.times_correct + (correct ? 1 : 0);
  const review_count = card.review_count + 1;
  const patch: Record<string, unknown> = {
    state: newState, next_review, interval_days, times_correct, review_count,
    last_reviewed_at: new Date().toISOString(),
  };
  if (newState !== card.state) patch.state_changed_at = new Date().toISOString();
  const { error } = await client.from('saved_words').update(patch as any).eq('id', card.id);
  if (error) console.error('submitReview', error);
  return newState;
}
