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
  return data as unknown as LinguaScript;
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

  const scripts = (data || []) as unknown as LinguaScript[];
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
