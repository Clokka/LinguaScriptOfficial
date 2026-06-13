// Red → Orange → Green core vocabulary system
import { supabase } from "@/integrations/supabase/client";

export type VocabState = "red" | "orange" | "green";

export interface CoreWord {
  id: string;
  rank: number;
  word: string;
  lemma: string;
  translation: string;
  pos: string | null;
  example_fr: string | null;
  example_en: string | null;
  frequency_weight: number;
  image_url: string | null;
  audio_url: string | null;
  topic: string | null;
}

export interface UserVocabRow {
  word_id: string;
  state: VocabState;
  times_seen: number;
  times_correct: number;
  promoted_at: string | null;
}

export const STATE_META: Record<VocabState, { label: string; dot: string; bg: string; ring: string; text: string }> = {
  red:    { label: "Red",    dot: "bg-red-500",    bg: "bg-red-500/10",    ring: "ring-red-500/40",    text: "text-red-500" },
  orange: { label: "Orange", dot: "bg-amber-500",  bg: "bg-amber-500/10",  ring: "ring-amber-500/40",  text: "text-amber-500" },
  green:  { label: "Green",  dot: "bg-emerald-500",bg: "bg-emerald-500/10",ring: "ring-emerald-500/40",text: "text-emerald-500" },
};

/** Normalize a raw token to a lemma-match candidate. */
export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…]/g, "")
    .trim();
}

export async function loadCoreVocabulary(language = "fr"): Promise<CoreWord[]> {
  const { data, error } = await supabase
    .from("core_vocabulary")
    .select("id, rank, word, lemma, translation, pos, example_fr, example_en, frequency_weight, image_url, audio_url, topic")
    .eq("language", language)
    .order("rank", { ascending: true });
  if (error) {
    console.error("loadCoreVocabulary", error);
    return [];
  }
  return (data as CoreWord[]) || [];
}

export async function loadUserVocabState(userId: string): Promise<Map<string, UserVocabRow>> {
  const { data, error } = await supabase
    .from("user_vocabulary_state")
    .select("word_id, state, times_seen, times_correct, promoted_at")
    .eq("user_id", userId);
  const map = new Map<string, UserVocabRow>();
  if (error) {
    console.error("loadUserVocabState", error);
    return map;
  }
  for (const row of (data as UserVocabRow[]) || []) map.set(row.word_id, row);
  return map;
}

/**
 * Frequency-weighted comprehension percentage.
 * Green = full weight, Orange = 0.5×, Red = 0.
 */
export function comprehensionPercent(
  words: CoreWord[],
  states: Map<string, UserVocabRow>,
): number {
  if (words.length === 0) return 0;
  let total = 0;
  let known = 0;
  for (const w of words) {
    total += w.frequency_weight;
    const s = states.get(w.id)?.state;
    if (s === "green") known += w.frequency_weight;
    else if (s === "orange") known += w.frequency_weight * 0.5;
  }
  return total > 0 ? Math.round((known / total) * 1000) / 10 : 0;
}

export function countByState(words: CoreWord[], states: Map<string, UserVocabRow>) {
  let green = 0, orange = 0;
  for (const w of words) {
    const s = states.get(w.id)?.state;
    if (s === "green") green++;
    else if (s === "orange") orange++;
  }
  const red = words.length - green - orange;
  return { green, orange, red };
}

/** Promote a word's state given a flashcard outcome. */
export async function recordReview(userId: string, wordId: string, correct: boolean): Promise<VocabState> {
  // Fetch current row
  const { data: existing } = await supabase
    .from("user_vocabulary_state")
    .select("state, times_seen, times_correct")
    .eq("user_id", userId)
    .eq("word_id", wordId)
    .maybeSingle();

  const prev = (existing?.state as VocabState | undefined) ?? "red";
  const timesSeen = (existing?.times_seen ?? 0) + 1;
  const timesCorrect = (existing?.times_correct ?? 0) + (correct ? 1 : 0);

  let next: VocabState;
  if (!correct) {
    // Demote green to orange; orange/red become orange.
    next = "orange";
  } else if (timesCorrect >= 3) {
    next = "green";
  } else {
    next = "orange";
  }

  const promoted_at = next !== prev && next === "green" ? new Date().toISOString() : undefined;

  await supabase.from("user_vocabulary_state").upsert(
    {
      user_id: userId,
      word_id: wordId,
      state: next,
      times_seen: timesSeen,
      times_correct: timesCorrect,
      ...(promoted_at ? { promoted_at } : {}),
    },
    { onConflict: "user_id,word_id" },
  );

  return next;
}

/** Mark word(s) as orange when first encountered (e.g. clicked or saved). */
export async function markEncountered(userId: string, wordIds: string[]): Promise<void> {
  if (wordIds.length === 0) return;
  const rows = wordIds.map((word_id) => ({
    user_id: userId,
    word_id,
    state: "orange" as VocabState,
    times_seen: 1,
    times_correct: 0,
  }));
  await supabase
    .from("user_vocabulary_state")
    .upsert(rows, { onConflict: "user_id,word_id", ignoreDuplicates: true });
}

/** Find the core word matching a free-text token via lemma list. */
export function findCoreWord(token: string, words: CoreWord[]): CoreWord | undefined {
  const n = normalizeToken(token);
  if (!n) return undefined;
  return words.find((w) => w.lemma === n || w.word === n);
}

/** Build a lemma -> CoreWord lookup. */
export function buildLemmaIndex(words: CoreWord[]): Map<string, CoreWord> {
  const m = new Map<string, CoreWord>();
  for (const w of words) {
    m.set(w.lemma, w);
    m.set(w.word, w);
  }
  return m;
}
