/**
 * Sentence-structure library.
 *
 * Teaching frequent words alone produces vocabulary, not language. Each
 * exercise therefore pairs the most frequent word the learner still owes with
 * a common *structure* ("Si ___, je ___", "Bien que ___, ___") graded at or
 * just below their level, so sentence shapes accumulate in usage order the
 * same way words do.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SentencePattern {
  id: string;
  language: string;
  cefr_level: string;
  usage_rank: number;
  template: string;
  explanation: string | null;
  example: string | null;
  example_translation: string | null;
}

const LEVEL_ORDER = ["a1", "a2", "b1", "b2", "c1", "c2"];

/** Levels at or below the learner's — never above, so nothing is out of reach. */
export function levelsUpTo(cefLevel: string | null | undefined): string[] {
  const lvl = (cefLevel || "a1").toLowerCase().replace("+", "");
  const idx = LEVEL_ORDER.indexOf(lvl);
  return LEVEL_ORDER.slice(0, idx === -1 ? 1 : idx + 1);
}

/** Patterns available to this learner, easiest and most common first. */
export async function loadPatterns(
  language: string,
  cefLevel: string,
): Promise<SentencePattern[]> {
  const { data, error } = await supabase
    .from("sentence_patterns" as any)
    .select("id, language, cefr_level, usage_rank, template, explanation, example, example_translation")
    .eq("language", language)
    .in("cefr_level", levelsUpTo(cefLevel))
    .order("cefr_level", { ascending: true })
    .order("usage_rank", { ascending: true });
  if (error) {
    console.warn("[sentencePatterns] load failed", error);
    return [];
  }
  return ((data as any[]) || []) as SentencePattern[];
}

/**
 * Patterns the learner has already practised recently, so the session rotates
 * through the library instead of drilling "C'est ___" forever.
 */
export async function recentlyUsedPatternIds(
  userId: string,
  language: string,
  limit = 40,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("linguascripts" as any)
    .select("pattern_id")
    .eq("user_id", userId)
    .eq("language", language)
    .not("pattern_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return new Set();
  return new Set(((data as any[]) || []).map((r) => r.pattern_id).filter(Boolean));
}

/**
 * Build a rotation queue: unseen patterns first (in usage order), then the
 * already-seen ones, so every session pushes into new structures while still
 * recycling old ones once the library is exhausted.
 */
export function orderPatternsForSession(
  patterns: SentencePattern[],
  recent: Set<string>,
): SentencePattern[] {
  const fresh = patterns.filter((p) => !recent.has(p.id));
  const seen = patterns.filter((p) => recent.has(p.id));
  return [...fresh, ...seen];
}
