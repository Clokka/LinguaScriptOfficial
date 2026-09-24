import { supabase } from "@/integrations/supabase/client";
import { CEFR_LEVELS, getLanguageProfile, type CefrLevel } from "@/lib/languageProfiles";

/**
 * Target Gold — gold that points at the words worth learning next.
 *
 * The Golden Reveal (goldenReveal.ts) only lights up words the learner has
 * already promoted to green, which is a nice reward but tells them nothing
 * new. Target Gold lights up words they have NOT saved yet but should:
 *
 *   stretch    a CEFR level or two above the learner (B1 → B2, C1)
 *   frequency  one of the most common words in the language
 *
 * Tapping one opens the normal translation popup; saving it is the claim
 * and pays GOLD_TARGET_XP on top of the usual save XP. Once saved it is in
 * the deck (red) and stops being a target, so it can't be farmed.
 */

/** How many CEFR levels above the learner still count as a stretch word. */
export const STRETCH_LEVELS = 2;

/** Words ranked at or above this are "high frequency". */
export const HIGH_FREQUENCY_RANK = 2000;

export type TargetReason = "stretch" | "frequency";

export interface TargetInfo {
  reason: TargetReason;
  /** CEFR level of the word, when known — shown in the popup badge. */
  level: CefrLevel | null;
  rank: number;
}

interface VocabRow {
  word: string;
  lemma: string | null;
  rank: number;
  cefr_level: string | null;
}

/** language → token → row (null = looked up, not in core_vocabulary). */
const vocabCache = new Map<string, Map<string, VocabRow | null>>();

/**
 * Look up the core_vocabulary rows for a line's tokens. Cached per language,
 * so each word is fetched once per session no matter how often it recurs.
 */
export async function lookupVocab(
  language: string,
  tokens: string[],
): Promise<Map<string, VocabRow | null>> {
  const lang = language.toLowerCase();
  let cache = vocabCache.get(lang);
  if (!cache) {
    cache = new Map();
    vocabCache.set(lang, cache);
  }

  const missing = [...new Set(tokens)].filter((t) => t && !cache!.has(t));
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from("core_vocabulary")
      .select("word, lemma, rank, cefr_level")
      .eq("language", lang)
      .in("word", missing);

    if (error) {
      // Leave the tokens uncached so a later line can retry.
      console.warn("[targetWords] lookup failed", error);
    } else {
      for (const row of (data ?? []) as VocabRow[]) {
        const key = row.word.toLowerCase();
        const prev = cache.get(key);
        // A word can appear more than once (homographs) — keep the commonest.
        if (!prev || row.rank < prev.rank) cache.set(key, row);
      }
      for (const t of missing) if (!cache.has(t)) cache.set(t, null);
    }
  }
  return cache;
}

/** The learner's CEFR level for a language, or null when there's no profile. */
export async function loadLearnerLevel(
  userId: string | null,
  language: string,
): Promise<CefrLevel | null> {
  if (!userId) return null;
  const profile = await getLanguageProfile(userId, language);
  const level = profile?.cefr_level?.toLowerCase() as CefrLevel | undefined;
  return level && CEFR_LEVELS.includes(level) ? level : null;
}

/** Is this word worth highlighting for a learner at `learnerLevel`? */
export function classifyTarget(
  row: VocabRow | null | undefined,
  learnerLevel: CefrLevel | null,
): TargetInfo | null {
  if (!row) return null;
  const level = (row.cefr_level?.toLowerCase() ?? null) as CefrLevel | null;
  const wordIdx = level ? CEFR_LEVELS.indexOf(level) : -1;

  if (learnerLevel && wordIdx >= 0) {
    const gap = wordIdx - CEFR_LEVELS.indexOf(learnerLevel);
    if (gap >= 1 && gap <= STRETCH_LEVELS) {
      return { reason: "stretch", level, rank: row.rank };
    }
  }
  if (row.rank <= HIGH_FREQUENCY_RANK) {
    return { reason: "frequency", level: wordIdx >= 0 ? level : null, rank: row.rank };
  }
  return null;
}

/**
 * Stretch words first (they're the ones the learner asked to be pushed on),
 * then the commonest words — so when the per-line cap bites, the most useful
 * words keep their gold.
 */
export function compareTargets(a: TargetInfo, b: TargetInfo): number {
  if (a.reason !== b.reason) return a.reason === "stretch" ? -1 : 1;
  return a.rank - b.rank;
}

/** Short label for the popup, e.g. "B2 word — a step above you". */
export function targetLabel(info: TargetInfo): string {
  if (info.reason === "stretch" && info.level) {
    return `${info.level.toUpperCase()} word — a step above your level`;
  }
  return `Top ${HIGH_FREQUENCY_RANK.toLocaleString()} most common word`;
}
