import type { LinguaScriptSupabaseClient } from './supabase';

export type DeckState = 'red' | 'orange' | 'green';

export interface SavedWordLite {
  id: string;
  word: string;
  language: string;
  state: DeckState;
  times_correct: number;
  review_count: number;
  next_review?: string | null;
}

export const coerceDeckState = (raw: string | null | undefined): DeckState =>
  raw === 'green' ? 'green' : raw === 'orange' ? 'orange' : 'red';

export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…]/g, '')
    .trim();
}

/**
 * Forward-only progression: cards NEVER move backwards.
 *  - Correct:   red→orange, orange→green, green stays.
 *  - Incorrect: card stays in its current deck (no demotion).
 */
export function nextState(current: DeckState, correct: boolean): DeckState {
  if (!correct) return current;
  if (current === 'red') return 'orange';
  if (current === 'orange') return 'green';
  return 'green';
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
  while (true) {
    const { data, error } = await client
      .from('saved_words')
      .select('id, word, language, state, times_correct, review_count, next_review')
      .eq('user_id', userId)
      .eq('language', language)
      .range(from, from + pageSize - 1);
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
    .select('id, word, language, state, times_correct, review_count, next_review, translation')
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

const SRS_INTERVAL_MINUTES: Record<DeckState, number> = {
  red: 60 * 4,
  orange: 60 * 24,
  green: 60 * 24 * 5,
};

export function computeNextReview(state: DeckState, correct: boolean): string {
  const base = SRS_INTERVAL_MINUTES[state];
  const factor = correct ? 1 : 0.25;
  const minutes = Math.max(30, Math.round(base * factor));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/** Record a review + advance SRS state + schedule next review. */
export async function submitReview(
  client: LinguaScriptSupabaseClient,
  card: SavedWordLite,
  correct: boolean,
): Promise<DeckState> {
  const newState = nextState(card.state, correct);
  const next_review = computeNextReview(newState, correct);
  const times_correct = card.times_correct + (correct ? 1 : 0);
  const review_count = card.review_count + 1;
  const { error } = await client
    .from('saved_words')
    .update({ state: newState, next_review, times_correct, review_count })
    .eq('id', card.id);
  if (error) console.error('submitReview', error);
  return newState;
}
