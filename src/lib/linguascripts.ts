/**
 * LinguaScripts: AI-generated contextual sentence learning from user's saved words
 * - Creates exercises from words user saved while watching videos
 * - Generates sentences based on user's interests and CEFR level
 * - Multiple formats: gap-fill, guess-the-word, MCQ, speaking
 * - Spaced repetition: 1-3-5-7 day review schedule
 */

import { supabase } from "@/integrations/supabase/client";

export interface LinguaScript {
  id: string;
  user_id: string;
  language: string;
  target_word: string;
  sentence: string;
  translation: string;
  word_state: "red" | "orange" | "green";
  interests: string[];
  cef_level: string;
  exercise_type: "gap-fill" | "guess-the-word" | "mcq" | "speaking";
  gap_position?: number;
  gap_options?: {
    correct: string;
    distractors: string[];
  };
  mcq_options?: {
    correct: number;
    options: string[];
  };
  audio_url?: string;
  created_at: string;
  completed_at?: string;
  status: "pending" | "started" | "completed" | "skipped";
  gap_answer?: string;
  mcq_answer?: number;
  correct?: boolean;
  attempts: number;
  xp_earned?: number;
  combo_multiplier: number;
  scheduled_for?: string;
}

/** ===== CORE: Load User's Real Saved Words ===== */

export interface SavedWord {
  id: string;
  word: string;
  state: "red" | "orange" | "green";
  created_at: string;
}

/**
 * Load user's REAL saved words from saved_words table
 * Grouped by state: GREEN (confidence), ORANGE (learning), RED (new)
 */
export async function loadUserSavedWords(userId: string | null, language: string) {
  if (!userId) return { green: [], orange: [], red: [] };

  try {
    const { data, error } = await supabase
      .from("saved_words")
      .select("id, word, state, created_at")
      .eq("user_id", userId)
      .eq("language", language)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Error loading saved words:", error);
      return { green: [], orange: [], red: [] };
    }

    if (!data) return { green: [], orange: [], red: [] };

    const green = (data as any[])
      .filter((w) => w.state === "green")
      .slice(0, 10); // Most recent 10

    const orange = (data as any[])
      .filter((w) => w.state === "orange")
      .slice(0, 10);

    const red = (data as any[])
      .filter((w) => w.state === "red")
      .slice(0, 10);

    return { green, orange, red };
  } catch (err) {
    console.error("Failed to load saved words:", err);
    return { green: [], orange: [], red: [] };
  }
}

/** ===== GENERATION: Create LinguaScript from Saved Word ===== */

/**
 * Generate a personalized LinguaScript sentence for a saved word
 * Uses Claude via edge function with interest + level awareness
 */
export async function generateLinguaScriptFromWord(params: {
  word: string;
  interests: string[];
  cefLevel: string;
  language: string;
  wordState: "red" | "orange" | "green";
  nativeLanguage: string;
}): Promise<{ sentence: string; translation: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "generate-personalized-linguascript",
      { body: params }
    );

    if (error) {
      console.error("Generation error:", error);
      return null;
    }

    return {
      sentence: data?.sentence || "",
      translation: data?.englishTranslation || "",
    };
  } catch (err) {
    console.error("Failed to generate LinguaScript:", err);
    return null;
  }
}

/** ===== SRS SCHEDULING: 1-3-5-7 Review Dates ===== */

/**
 * Calculate next review date based on word state
 * RED (new): 1 day, ORANGE (learning): 3 days, GREEN (known): 7 days
 */
export function getNextReviewDate(wordState: "red" | "orange" | "green"): Date {
  const now = new Date();
  const daysMap = { red: 1, orange: 3, green: 7 };
  const days = daysMap[wordState];
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** ===== DATABASE: Create LinguaScript Records ===== */

/**
 * Create a LinguaScript exercise from a saved word
 */
export async function createLinguaScriptFromSavedWord(
  userId: string,
  word: string,
  sentence: string,
  translation: string,
  wordState: "red" | "orange" | "green",
  language: string,
  interests: string[]
): Promise<LinguaScript | null> {
  try {
    const scheduledFor = getNextReviewDate(wordState);

    const { data, error } = await supabase
      .from("linguascripts")
      .insert({
        user_id: userId,
        language,
        target_word: word,
        sentence,
        translation,
        word_state: wordState,
        interests,
        cef_level: "B1",
        exercise_type: "gap-fill",
        status: "pending",
        attempts: 0,
        combo_multiplier: 1,
        xp_earned: 0,
        scheduled_for: scheduledFor.toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Failed to create LinguaScript:", error);
      return null;
    }

    return data as LinguaScript;
  } catch (err) {
    console.error("Error creating LinguaScript:", err);
    return null;
  }
}

/** ===== RETRIEVAL: Get LinguaScripts for User ===== */

/**
 * Get upcoming LinguaScripts due for review (scheduled_for <= now)
 * Ordered by state (GREEN first for confidence building)
 */
export async function getUpcomingLinguaScripts(
  userId: string,
  language: string,
  limit = 10
): Promise<LinguaScript[]> {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("linguascripts")
      .select("*")
      .eq("user_id", userId)
      .eq("language", language)
      .lte("scheduled_for", now)
      .is("completed_at", null)
      .order("word_state", { ascending: false }) // GREEN before ORANGE before RED
      .order("scheduled_for", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Error fetching LinguaScripts:", error);
      return [];
    }

    return (data || []) as LinguaScript[];
  } catch (err) {
    console.error("Failed to get LinguaScripts:", err);
    return [];
  }
}

/**
 * Get all LinguaScripts for a user (not just due ones)
 */
export async function getAllUserLinguaScripts(
  userId: string,
  language: string
): Promise<LinguaScript[]> {
  try {
    const { data, error } = await supabase
      .from("linguascripts")
      .select("*")
      .eq("user_id", userId)
      .eq("language", language)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching all LinguaScripts:", error);
      return [];
    }

    return (data || []) as LinguaScript[];
  } catch (err) {
    console.error("Failed to get all LinguaScripts:", err);
    return [];
  }
}

/** ===== SUBMISSION: Record Answers ===== */

/**
 * Record a completed LinguaScript with XP
 */
export async function recordLinguaScriptCompletion(
  linguascriptId: string,
  correct: boolean,
  xpEarned: number,
  comboMultiplier: number = 1
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("linguascripts")
      .update({
        status: correct ? "completed" : "started",
        correct,
        completed_at: correct ? new Date().toISOString() : null,
        xp_earned: xpEarned,
        combo_multiplier: comboMultiplier,
        attempts: (await getCurrentAttempts(linguascriptId)) + 1,
      } as any)
      .eq("id", linguascriptId);

    return !error;
  } catch (err) {
    console.error("Failed to record completion:", err);
    return false;
  }
}

/**
 * Helper: Get current attempts count
 */
async function getCurrentAttempts(linguascriptId: string): Promise<number> {
  const { data } = await supabase
    .from("linguascripts")
    .select("attempts")
    .eq("id", linguascriptId)
    .single();

  return data?.attempts || 0;
}
