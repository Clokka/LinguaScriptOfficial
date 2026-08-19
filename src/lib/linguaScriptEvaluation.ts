/**
 * LinguaScript Evaluation Engine
 *
 * Evaluates user-created sentences using tiered scoring:
 * - 50 XP: Perfect grammar and usage
 * - 30 XP: Good, minor errors (conjugation, article, accent)
 * - 15 XP: Understandable, comprehensible but has errors
 * - 0 XP: Wrong word used or incomprehensible
 *
 * Provides corrective feedback (not harsh, not patronizing)
 */
import { supabase } from "@/integrations/supabase/client";

export interface EvaluationResult {
  word: string;
  userText: string;
  score: number; // 50, 30, 15, or 0
  feedback: string;
  corrections?: string[];
}

/**
 * Evaluate a single sentence created by the user
 *
 * This is called by the API endpoint which uses Claude to evaluate
 * Returns: score and feedback
 */
export async function evaluateLinguaScript(
  word: string,
  userSentence: string
): Promise<EvaluationResult> {
  // This function is a placeholder that will be called by the API
  // The actual AI evaluation happens in supabase/functions/evaluate-linguascript

  // Local validation rules for immediate feedback
  const normalizedWord = word.toLowerCase().trim();
  const normalizedSentence = userSentence.toLowerCase().trim();

  // Check if word is present
  const wordPresent = normalizedSentence.includes(normalizedWord);

  if (!wordPresent) {
    return {
      word,
      userText: userSentence,
      score: 0,
      feedback: `The word "${word}" doesn't appear in your sentence. Try using it naturally.`,
    };
  }

  // If word is present, check comprehensibility
  // This is where the real AI evaluation comes in via the API
  // For now, return a placeholder that will be replaced by API
  return {
    word,
    userText: userSentence,
    score: 15, // Conservative default
    feedback: `Good! You used "${word}" in context. Check the grammar.`,
  };
}

/**
 * Batch evaluate multiple sentences
 */
export async function evaluateLinguaScripts(
  sentences: Array<{ word: string; text: string }>
): Promise<EvaluationResult[]> {
  // Two bugs lived here. The URL pointed at /api/evaluate-linguascripts, which
  // does not exist — this is a Vite SPA with no proxy and no rewrite config, so
  // the request hit the app itself and came back as HTML. And the body was a
  // bare array, while the edge function destructures `{ sentences }`, so even a
  // correctly addressed call would have been rejected as malformed.
  const { data, error } = await supabase.functions.invoke("evaluate-linguascripts", {
    body: { sentences },
  });

  if (error) throw new Error(error.message || "Failed to evaluate linguascripts");
  if (!Array.isArray(data)) throw new Error("Evaluation returned an unexpected shape");

  return data as EvaluationResult[];
}

/**
 * Score tier mapping for UI feedback
 */
export const SCORE_TIERS = {
  PERFECT: { score: 50, label: "Perfect", color: "emerald" },
  GOOD: { score: 30, label: "Great", color: "amber" },
  UNDERSTANDABLE: { score: 15, label: "Good", color: "amber" },
  WRONG: { score: 0, label: "Try Again", color: "red" },
} as const;

/**
 * Get XP color based on score
 */
export function getScoreColor(score: number): string {
  if (score >= 50) return "text-emerald-400";
  if (score >= 30) return "text-amber-400";
  if (score >= 15) return "text-amber-400";
  return "text-red-400";
}

/**
 * Get score tier label
 */
export function getScoreTier(score: number): string {
  if (score >= 50) return "Perfect";
  if (score >= 30) return "Great";
  if (score >= 15) return "Good";
  return "Try Again";
}
