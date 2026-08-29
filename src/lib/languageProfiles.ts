import { supabase } from "@/integrations/supabase/client";

/**
 * A learner has one profile per language (max 5). Each carries its own
 * learning mode, CEFR level, comprehension score and goals, so switching
 * language switches the whole learning experience.
 */
export type LearningMode = "fluency" | "cefr";

export const MAX_LANGUAGES = 5;

export const CEFR_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Cumulative vocabulary size targets per CEFR level (real-world figures). */
export const CEFR_TARGETS: Record<CefrLevel, number> = {
  a1: 600,
  a2: 1200,
  b1: 2500,
  b2: 4500,
  c1: 9000,
  c2: 16000,
};

export const nextCefrLevel = (level: string): CefrLevel | null => {
  const i = CEFR_LEVELS.indexOf(level.toLowerCase() as CefrLevel);
  if (i < 0 || i === CEFR_LEVELS.length - 1) return null;
  return CEFR_LEVELS[i + 1];
};

export const MODE_META: Record<LearningMode, { label: string; blurb: string; emoji: string }> = {
  fluency: {
    label: "Fluency fast-track",
    blurb:
      "The 3,000 most useful words, in frequency order. Fastest route to understanding real speech — ideal for travel and everyday conversation.",
    emoji: "⚡",
  },
  cefr: {
    label: "Exam track (CEFR)",
    blurb:
      "Official A1–C2 level word lists. Learn every word of your level to advance to the next — built for students sitting CEFR-based exams.",
    emoji: "🎓",
  },
};

export interface LanguageProfile {
  id: string;
  user_id: string;
  language: string;
  mode: LearningMode;
  cefr_level: string;
  seeded_level: string | null;
  seeded_mode: string | null;
  understanding_score: number;
  words_known: number;
  daily_word_goal: number;
  daily_video_goal: number;
  interests: string[];
  last_active_at: string;
}

const table = () => (supabase as any).from("language_profiles");

export async function listLanguageProfiles(userId: string): Promise<LanguageProfile[]> {
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userId)
    .order("last_active_at", { ascending: false });
  if (error) {
    console.error("listLanguageProfiles", error);
    return [];
  }
  return (data ?? []) as LanguageProfile[];
}

export async function getLanguageProfile(
  userId: string,
  language: string,
): Promise<LanguageProfile | null> {
  const { data } = await table()
    .select("*")
    .eq("user_id", userId)
    .eq("language", language.toLowerCase())
    .maybeSingle();
  return (data as LanguageProfile) ?? null;
}

/**
 * Create (or fetch) the profile for a language and seed the learner's known
 * vocabulary for the chosen level + mode. Safe to call repeatedly.
 */
export async function addLanguageProfile(opts: {
  userId: string;
  language: string;
  mode: LearningMode;
  level: string;
}): Promise<{ profile: LanguageProfile | null; error?: string }> {
  const language = opts.language.toLowerCase();
  const existing = await getLanguageProfile(opts.userId, language);
  if (existing) {
    await table()
      .update({ mode: opts.mode, cefr_level: opts.level.toLowerCase() })
      .eq("id", existing.id);
  } else {
    const current = await listLanguageProfiles(opts.userId);
    if (current.length >= MAX_LANGUAGES) return { profile: null, error: "language_limit_reached" };
    const { error } = await table().insert({
      user_id: opts.userId,
      language,
      mode: opts.mode,
      cefr_level: opts.level.toLowerCase(),
    });
    if (error) return { profile: null, error: error.message };
  }

  await seedForProfile(language, opts.level, opts.mode);
  return { profile: await getLanguageProfile(opts.userId, language) };
}

export async function seedForProfile(language: string, level: string, mode: LearningMode) {
  if (!level || level === "below") return;
  try {
    await (supabase as any).rpc("seed_known_vocabulary", {
      _language: language.toLowerCase(),
      _level: level.toLowerCase(),
      _mode: mode,
    });
  } catch (e) {
    console.warn("seed_known_vocabulary failed", e);
  }
}

export async function removeLanguageProfile(userId: string, language: string) {
  await table().delete().eq("user_id", userId).eq("language", language.toLowerCase());
}

export async function touchLanguageProfile(userId: string, language: string) {
  await table()
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("language", language.toLowerCase());
}

export async function updateLanguageProfile(
  userId: string,
  language: string,
  patch: Partial<Pick<LanguageProfile, "mode" | "cefr_level" | "daily_word_goal" | "daily_video_goal">>,
) {
  await table().update(patch).eq("user_id", userId).eq("language", language.toLowerCase());
}

export interface CefrProgress {
  level: string;
  total_words: number;
  known_words: number;
  can_advance: boolean;
  next_level: string | null;
}

/** Progress through the current CEFR level's word list (exam track). */
export async function fetchCefrProgress(language: string): Promise<CefrProgress | null> {
  const { data, error } = await (supabase as any).rpc("cefr_level_progress", {
    _language: language.toLowerCase(),
  });
  if (error) {
    console.warn("cefr_level_progress", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as CefrProgress) ?? null;
}

/** Advance the learner one CEFR level when their current list is complete. */
export async function advanceCefrLevel(userId: string, language: string): Promise<string | null> {
  const progress = await fetchCefrProgress(language);
  if (!progress?.can_advance || !progress.next_level) return null;
  await updateLanguageProfile(userId, language, { cefr_level: progress.next_level });
  return progress.next_level;
}
