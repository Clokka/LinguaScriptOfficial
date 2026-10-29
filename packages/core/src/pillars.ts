/**
 * The Chameleon Method — pillars 2 (✍️ write) and 3 (🗣️ speak) for the mobile
 * app. Mirrors src/lib/pillars.ts on the website (which also keeps the
 * browser-only bits); both call the same `linguascript-write` function.
 */
import type { LinguaScriptSupabaseClient } from './supabase';
import { coerceDeckState, isDueGold, nextReviewInterval, dateInDays, nextState, normalizeToken, type DeckState } from './vocab';

export type WordColour = DeckState | 'gold';

export const COLOUR_HEX: Record<WordColour, string> = {
  red: '#FF3B30',
  orange: '#FF8A00',
  green: '#34C759',
  gold: '#FFD54A',
};

export interface PillarWord {
  id: string;
  word: string;
  translation: string | null;
  state: DeckState;
  next_review: string | null;
  interval_days: number | null;
  review_count: number | null;
  times_correct: number | null;
}

export interface PillarDeck {
  red: PillarWord[];
  colours: Map<string, WordColour>;
  common: Set<string>;
  greenSample: string[];
}

export async function loadPillarDeck(client: LinguaScriptSupabaseClient, userId: string, language: string): Promise<PillarDeck> {
  const colours = new Map<string, WordColour>();
  const all: PillarWord[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await client
      .from('saved_words')
      .select('id, word, translation, state, next_review, interval_days, review_count, times_correct, created_at')
      .eq('user_id', userId)
      .eq('language', language)
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (error) break;
    const rows = (data as any[]) || [];
    for (const r of rows) {
      const w: PillarWord = { ...r, state: coerceDeckState(r.state) };
      all.push(w);
      const k = normalizeToken(w.word);
      if (k && !colours.has(k)) colours.set(k, isDueGold(w) ? 'gold' : w.state);
    }
    if (rows.length < 1000) break;
  }
  const common = new Set<string>();
  const { data: cv } = await (client as any)
    .from('core_vocabulary')
    .select('word, rank')
    .eq('language', language)
    .order('rank', { ascending: true })
    .limit(1000);
  for (const r of (cv as any[]) || []) {
    const k = normalizeToken(String(r.word || ''));
    if (k && !/\s/.test(k)) common.add(k);
  }
  const greens = all.filter((w) => w.state === 'green').map((w) => w.word);
  return {
    red: all.filter((w) => w.state === 'red'),
    colours,
    common,
    greenSample: Array.from(new Set([...greens.slice(0, 20), ...Array.from(common).slice(0, 120)])).slice(0, 60),
  };
}

export function colourOf(deck: PillarDeck | null, raw: string): WordColour | null {
  if (!deck) return null;
  const k = normalizeToken(raw);
  if (!k) return null;
  return deck.colours.get(k) ?? (deck.common.has(k) ? 'green' : null);
}

export function tokenize(text: string): { text: string; word: boolean }[] {
  const out: { text: string; word: boolean }[] = [];
  const re = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), word: false });
    out.push({ text: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false });
  return out;
}

export function usesWord(text: string, word: string): boolean {
  const key = normalizeToken(word);
  if (!key) return false;
  if (/\s/.test(key)) return normalizeToken(text).includes(key);
  return tokenize(text).some((p) => p.word && normalizeToken(p.text) === key);
}

/** Using a word for real counts as a correct review: red → orange → green. */
export async function promoteUsedWord(client: LinguaScriptSupabaseClient, userId: string, w: PillarWord): Promise<DeckState> {
  const newState = nextState(w.state, true);
  const interval_days = nextReviewInterval(w.interval_days, true, w.state === 'green', newState === 'green');
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    state: newState,
    times_correct: (w.times_correct ?? 0) + 1,
    review_count: (w.review_count ?? 0) + 1,
    interval_days,
    next_review: dateInDays(interval_days),
    last_reviewed_at: now,
    last_correct_at: now,
  };
  if (newState !== w.state) patch.state_changed_at = now;
  await client.from('saved_words').update(patch as any).eq('id', w.id).eq('user_id', userId);
  return newState;
}

export function pickRedPair(red: PillarWord[], round: number): PillarWord[] {
  if (!red.length) return [];
  const pool = red.slice(0, 12);
  const a = pool[(round * 2) % pool.length];
  const b = pool[(round * 2 + 1) % pool.length];
  return pool.length > 1 && round % 3 !== 2 && a.id !== b.id ? [a, b] : [a];
}

export interface Composed { prompt: string; linguascript: string; translation: string }
export interface Checked { score: number; usedWords: string[]; feedback: string; corrected: string; translation: string }

export interface WriteArgs {
  language: string;
  nativeLanguage: string;
  redWords: { word: string; translation?: string | null }[];
  greenWords?: string[];
  interest: string;
  about: string;
}

export async function composeLinguaScript(client: LinguaScriptSupabaseClient, a: WriteArgs): Promise<Composed | null> {
  const { data, error } = await client.functions.invoke('linguascript-write', {
    body: { mode: 'compose', ...a, greenWords: (a.greenWords || []).map((word) => ({ word })) },
  });
  return !error && (data as any)?.linguascript ? (data as Composed) : null;
}

export async function checkLinguaScript(client: LinguaScriptSupabaseClient, a: WriteArgs & { text: string }): Promise<Checked | null> {
  const { data, error } = await client.functions.invoke('linguascript-write', { body: { mode: 'check', ...a, greenWords: [] } });
  return !error && typeof (data as any)?.score === 'number' ? (data as Checked) : null;
}

export const INTEREST_EMOJI: Record<string, string> = {
  gaming: '🎮', football: '⚽', fitness: '🏃', travel: '✈️', cooking: '🍳', music: '🎵', films: '🎬',
  comedy: '🎭', history: '📚', business: '💼', news: '📰', podcasts: '🎙️', cars: '🚗', art: '🎨',
  culture: '🌍', language: '📖', tech: '📱', entrepreneurship: '📈', anime: '🇯🇵',
};

export const ABOUT_QUESTION: Record<string, string> = {
  travel: 'Where are you going?', football: 'Your team?', gaming: 'Favourite game?', fitness: 'Your sport?',
  cooking: 'Favourite dish?', music: 'Favourite artist?', films: 'Favourite film or show?', anime: 'Favourite anime?',
  business: "What's your business?", entrepreneurship: 'What are you building?', cars: 'Dream car?', tech: 'Favourite gadget?',
};

export const SPEECH_LANG: Record<string, string> = {
  fr: 'fr-FR', es: 'es-ES', de: 'de-DE', it: 'it-IT', pt: 'pt-PT', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR',
  ar: 'ar-SA', hi: 'hi-IN', ru: 'ru-RU', tr: 'tr-TR', nl: 'nl-NL', pl: 'pl-PL', sv: 'sv-SE', th: 'th-TH', en: 'en-GB',
};
