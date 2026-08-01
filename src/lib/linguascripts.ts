/**
 * LinguaScripts: AI-generated contextual sentence learning
 * - Generates sentences based on user's interests
 * - Supports gap-fill, multiple-choice, and speaking modes
 * - Auto-schedules completed words into the SRS
 */

import { supabase } from "@/integrations/supabase/client";

export interface LinguaScript {
  id: string;
  user_id: string;
  language: string;
  target_word: string;
  sentence: string;
  translation: string;
  interest: string;
  gap_position: number;
  gap_options: {
    correct: string;
    distractors: string[];
  };
  mcq_options: {
    correct: number;
    options: string[];
  };
  audio_url?: string;
  created_at: string;
  completed_at?: string;
  status: "pending" | "started" | "completed" | "skipped";
  gap_answer?: string;
  mcq_answer?: number;
  speaking_answer?: string;
  correct?: boolean;
  attempts: number;
  time_spent_ms?: number;
  scheduled_to_srs: boolean;
  combo_multiplier: number;
  xp_earned?: number;
}

export interface GeneratedContent {
  sentence: string;
  translation: string;
  interest: string;
  gapPosition: number;
  gapOptions: {
    correct: string;
    distractors: string[];
  };
  mcqOptions: {
    correct: number;
    options: string[];
  };
}

/**
 * Generate a new LinguaScript for a word based on user interests
 */
export async function generateLinguaScript(
  targetWord: string,
  language: string,
  interests: string[] = []
): Promise<GeneratedContent> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-linguascript`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
      },
      body: JSON.stringify({
        targetWord,
        language,
        interests,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a LinguaScript in the database
 */
export async function createLinguaScript(
  userId: string,
  language: string,
  targetWord: string,
  content: GeneratedContent
): Promise<LinguaScript> {
  const { data, error } = await supabase
    .from("linguascripts")
    .insert({
      user_id: userId,
      language,
      target_word: targetWord,
      sentence: content.sentence,
      translation: content.translation,
      interest: content.interest,
      gap_position: content.gapPosition,
      gap_options: content.gapOptions,
      mcq_options: content.mcqOptions,
      status: "pending",
      attempts: 0,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as LinguaScript;
}

/**
 * Get today's LinguaScripts for a user
 */
export async function getDailyLinguascripts(
  userId: string,
  language: string
): Promise<LinguaScript[]> {
  const { data, error } = await supabase
    .rpc("get_daily_linguascripts", {
      p_user_id: userId,
      p_language: language,
    })
    .returns<LinguaScript[]>();

  if (error) throw error;
  return data || [];
}

/**
 * Submit gap-fill answer
 */
export async function submitGapFill(
  linguascriptId: string,
  userAnswer: string,
  targetWord: string,
  combo: number = 1
): Promise<{ correct: boolean; xp: number }> {
  const correct =
    userAnswer.toLowerCase().trim() ===
    targetWord.toLowerCase().trim();

  const xp = correct ? 15 * combo : 0;

  const { error } = await supabase
    .from("linguascripts")
    .update({
      gap_answer: userAnswer,
      correct,
      attempts: (await supabase
        .from("linguascripts")
        .select("attempts")
        .eq("id", linguascriptId)
        .single()
        .then((r) => r.data?.attempts || 0)) + 1,
      status: correct ? "completed" : "started",
      xp_earned: xp,
      completed_at: correct ? new Date().toISOString() : null,
      combo_multiplier: combo,
    } as any)
    .eq("id", linguascriptId);

  if (error) throw error;

  // If correct, schedule to SRS and award XP
  if (correct) {
    await scheduleLinguascriptToSrs(linguascriptId);
  }

  return { correct, xp };
}

/**
 * Submit multiple-choice answer
 */
export async function submitMCQ(
  linguascriptId: string,
  selectedIndex: number,
  correctIndex: number,
  combo: number = 1
): Promise<{ correct: boolean; xp: number }> {
  const correct = selectedIndex === correctIndex;
  const xp = correct ? 15 * combo : 0;

  const { error } = await supabase
    .from("linguascripts")
    .update({
      mcq_answer: selectedIndex,
      correct,
      attempts: (await supabase
        .from("linguascripts")
        .select("attempts")
        .eq("id", linguascriptId)
        .single()
        .then((r) => r.data?.attempts || 0)) + 1,
      status: correct ? "completed" : "started",
      xp_earned: xp,
      completed_at: correct ? new Date().toISOString() : null,
      combo_multiplier: combo,
    } as any)
    .eq("id", linguascriptId);

  if (error) throw error;

  if (correct) {
    await scheduleLinguascriptToSrs(linguascriptId);
  }

  return { correct, xp };
}

/**
 * Schedule a completed LinguaScript's word into the SRS
 */
export async function scheduleLinguascriptToSrs(
  linguascriptId: string
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { error } = await supabase.rpc(
    "schedule_linguascript_to_srs",
    {
      p_linguascript_id: linguascriptId,
      p_user_id: userId,
    }
  );

  if (error) throw error;
}

/**
 * Skip a LinguaScript (increments skip counter for combo reset tracking)
 */
export async function skipLinguascript(linguascriptId: string): Promise<void> {
  const { error } = await supabase
    .from("linguascripts")
    .update({
      status: "skipped",
      completed_at: new Date().toISOString(),
    } as any)
    .eq("id", linguascriptId);

  if (error) throw error;
}

/**
 * Get statistics for today's LinguaScripts
 */
export async function getLinguascriptStats(
  userId: string,
  language: string
): Promise<{
  total: number;
  completed: number;
  correct: number;
  xpEarned: number;
  avgCombo: number;
}> {
  const { data, error } = await supabase
    .from("linguascripts")
    .select("*")
    .eq("user_id", userId)
    .eq("language", language)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) throw error;

  const scripts = (data || []) as LinguaScript[];
  const completed = scripts.filter((s) => s.status === "completed");
  const correct = completed.filter((s) => s.correct).length;
  const xpEarned = scripts.reduce((sum, s) => sum + (s.xp_earned || 0), 0);
  const avgCombo =
    completed.length > 0
      ? completed.reduce((sum, s) => sum + s.combo_multiplier, 0) / completed.length
      : 1;

  return {
    total: scripts.length,
    completed: completed.length,
    correct,
    xpEarned,
    avgCombo,
  };
}

/**
 * Create LinguaScript from a saved word using RPC
 */
export async function createLinguaScriptFromSavedWord(
  userId: string,
  savedWordId: string,
  word: string,
  translation: string,
  language: string,
  context: string,
  gapOptions: any,
  mcqOptions: any
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "create_linguascript_from_saved_word",
    {
      p_user_id: userId,
      p_saved_word_id: savedWordId,
      p_word: word,
      p_translation: translation,
      p_language: language,
      p_context: context,
      p_gap_options: gapOptions,
      p_mcq_options: mcqOptions,
    }
  );

  if (error) throw error;
  return data;
}

/** ===== NEW: Personalized LinguaScripts from Saved Words ===== */

export interface SavedWord {
  word: string;
  translation: string;
  state: "red" | "orange" | "green";
  created_at: string;
}

/**
 * Load user's recent saved words, grouped by SRS state (GREEN, ORANGE, RED)
 * GREEN first (for confidence building), then ORANGE, then RED (challenging)
 */
export async function loadUserSavedWords(userId: string | null, language: string) {
  if (!userId) return { green: [], orange: [], red: [] };

  const { data, error } = await supabase
    .from("vocab_deck")
    .select("word, translation, state, created_at")
    .eq("user_id", userId)
    .eq("language", language)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return { green: [], orange: [], red: [] };

  const green = (data as any[])
    .filter((w) => w.state === "green")
    .slice(0, 8);
  const orange = (data as any[])
    .filter((w) => w.state === "orange")
    .slice(0, 8);
  const red = (data as any[])
    .filter((w) => w.state === "red")
    .slice(0, 8);

  return { green, orange, red };
}

/**
 * Generate personalized LinguaScript sentence from a saved word
 * Uses Claude to create interest-aware, level-appropriate context
 */
export async function generatePersonalizedLinguaScript(params: {
  word: string;
  translation: string;
  interests: string[];
  cefLevel: string;
  language: string;
  wordState: "red" | "orange" | "green";
  nativeLanguage: string;
}): Promise<{ sentence: string; englishTranslation: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "generate-personalized-linguascript",
      {
        body: params,
      }
    );

    if (error || !data?.sentence) {
      console.error("Failed to generate personalized LinguaScript:", error);
      return null;
    }

    return {
      sentence: data.sentence,
      englishTranslation: data.englishTranslation || data.sentence,
    };
  } catch (err) {
    console.error("Personalized LinguaScript generation error:", err);
    return null;
  }
}

/**
 * Get next review date based on SRS state (1-3-5-7 day schedule)
 */
export function getNextReviewDate(wordState: "red" | "orange" | "green"): Date {
  const now = new Date();
  let daysUntilReview = 1; // RED → review in 1 day
  if (wordState === "orange") daysUntilReview = 3; // ORANGE → review in 3 days
  if (wordState === "green") daysUntilReview = 7; // GREEN → review in 7 days (maintenance)

  const nextReview = new Date(now.getTime() + daysUntilReview * 24 * 60 * 60 * 1000);
  return nextReview;
}

/**
 * Create a LinguaScript session from a saved word
 */
export async function createLinguaScriptSessionFromWord(
  userId: string,
  word: string,
  translation: string,
  sentence: string,
  englishTranslation: string,
  wordState: "red" | "orange" | "green",
  interests: string[],
  language: string
): Promise<LinguaScript | null> {
  const nextReview = getNextReviewDate(wordState);

  const { data, error } = await supabase
    .from("linguascripts")
    .insert({
      user_id: userId,
      language,
      target_word: word,
      sentence,
      translation: englishTranslation,
      interest: interests[0] || "general",
      gap_position: sentence.indexOf(word),
      status: "pending",
      attempts: 0,
      scheduled_to_srs: true,
      combo_multiplier: 1,
      next_review_at: nextReview.toISOString(),
    } as any)
    .select()
    .single();

  if (error) {
    console.error("Failed to create LinguaScript session:", error);
    return null;
  }

  return data as LinguaScript;
}
