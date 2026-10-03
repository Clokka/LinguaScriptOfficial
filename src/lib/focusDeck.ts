/**
 * The "focus deck": the learner's current Top-N block of the frequency ladder.
 * Ten new words from it go into flashcards each day on their own, and its
 * unlearned words get gold rings while watching.
 */
import { supabase } from "@/integrations/supabase/client";
import { loadFrequencyCoverage, unlockedBand } from "@/lib/frequencyCoverage";
import { getNativeLanguage, overlayNative } from "@/lib/nativeGloss";
import { normalizeToken } from "@/lib/vocab";

export const DAILY_NEW = 10;

interface CoreWord { rank: number; word: string; translation: string; cefr_level: string | null }

export interface FocusDeck { band: number; words: CoreWord[]; known: Set<string>; saved: Set<string> }

export async function loadFocusDeck(userId: string, language: string): Promise<FocusDeck | null> {
  const lang = language.toLowerCase();
  const bands = await loadFrequencyCoverage(lang);
  if (bands.length === 0) return null;
  const band = unlockedBand(bands);
  const { data } = await supabase
    .from("core_vocabulary")
    .select("rank, word, translation, cefr_level")
    .eq("language", lang)
    .order("rank")
    .range(band - 50, band - 1);
  const words = (data as CoreWord[]) || [];
  if (words.length === 0) return null;
  const { data: rows } = await supabase
    .from("saved_words")
    .select("word, state")
    .eq("user_id", userId)
    .eq("language", lang)
    .in("word", words.map((w) => w.word));
  const known = new Set<string>();
  const saved = new Set<string>();
  for (const r of (rows as any[]) || []) {
    const k = normalizeToken(r.word);
    saved.add(k);
    if (r.state === "green") known.add(k);
  }
  return { band, words, known, saved };
}

/** Unlearned focus-deck words, for gold rings in the subtitles. */
export async function focusRingWords(userId: string, language: string): Promise<string[]> {
  const deck = await loadFocusDeck(userId, language);
  if (!deck) return [];
  return deck.words.map((w) => normalizeToken(w.word)).filter((w) => !deck.known.has(w));
}

/**
 * Adds today's new words (up to DAILY_NEW) from the focus deck to flashcards.
 * Words from this deck saved today (e.g. from a video) count toward the 10.
 * Safe to call many times a day. Returns how many were added today in total.
 */
export async function topUpDailyNew(userId: string, language: string): Promise<{ band: number; addedToday: number } | null> {
  const lang = language.toLowerCase();
  const deck = await loadFocusDeck(userId, lang);
  if (!deck) return null;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("saved_words")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("language", lang)
    .gte("created_at", midnight.toISOString())
    .lt("next_review", "2999-01-01")
    .in("word", deck.words.map((w) => w.word));
  const already = count ?? 0;
  const need = DAILY_NEW - already;
  if (need <= 0) return { band: deck.band, addedToday: already };
  const fresh = deck.words.filter((w) => !deck.saved.has(normalizeToken(w.word))).slice(0, need);
  if (fresh.length === 0) return { band: deck.band, addedToday: already };
  const glossed = await overlayNative(fresh, lang, await getNativeLanguage(userId));
  await supabase.from("saved_words").upsert(
    glossed.map((w) => ({
      user_id: userId, word: w.word, translation: w.translation,
      pronunciation: "", ipa: "", context: "", language: lang, state: "red",
      frequency_rank: w.rank, frequency_level: w.cefr_level,
    })) as any,
    { onConflict: "user_id,word,language", ignoreDuplicates: true },
  );
  return { band: deck.band, addedToday: already + fresh.length };
}
