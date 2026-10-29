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
  interval_days?: number | null;
}

export const coerceDeckState = (raw: string | null | undefined): DeckState =>
  raw === 'green' ? 'green' : raw === 'orange' ? 'orange' : 'red';

export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, '')
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
    .select('id, word, language, state, times_correct, review_count, next_review, interval_days, translation')
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

/**
 * The LinguaScript review ladder — identical to src/lib/vocab.ts.
 * Green words come back after 1, 3, 7, 14, 30 days, then ×1.5 forever.
 * A green word that's due shows GOLD; reviewing it sends it back to green.
 */
export const REVIEW_LADDER_DAYS = [1, 3, 7, 14, 30] as const;
export const REVIEW_GROWTH = 1.5;

export function nextReviewInterval(prevIntervalDays: number | null | undefined, correct: boolean, wasGreen: boolean, isGreen: boolean): number {
  if (!correct || !isGreen || !wasGreen) return 1;
  const prev = Math.max(0, prevIntervalDays ?? 0);
  const rung = REVIEW_LADDER_DAYS.find((d) => d > prev);
  if (rung !== undefined) return rung;
  return Math.max(prev + 1, Math.round(prev * REVIEW_GROWTH));
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today's date (YYYY-MM-DD) in the learner's timezone. */
export function todayLocal(): string {
  return ymd(new Date());
}

export function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
}

/** GOLD = green + review due. */
export function isDueGold(word: { state?: string | null; next_review?: string | null } | null | undefined): boolean {
  if (!word || word.state !== 'green' || !word.next_review) return false;
  return String(word.next_review).slice(0, 10) <= todayLocal();
}

/** red / orange / green / gold — what colour a word shows right now. */
export function displayState(word: { state?: string | null; next_review?: string | null }): DeckState | 'gold' {
  return isDueGold(word) ? 'gold' : coerceDeckState(word.state);
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
