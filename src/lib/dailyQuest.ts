import { supabase } from "@/integrations/supabase/client";

/**
 * The daily quest's four stages: save the day's words, celebrate hitting the
 * goal, review what was saved (LinguaScriptSession's gap-fill + tile-builder
 * + active-recall), then build with it (the same session's production
 * stage) — see LinguaScriptSession.tsx, which already runs review straight
 * into production per word.
 */
export type QuestStage = "saving" | "celebrate" | "review" | "build" | "done";

export interface DailyQuestProgress {
  wordsSaved: number;
  celebratedAt: string | null;
  reviewedAt: string | null;
  builtAt: string | null;
}

const EMPTY_PROGRESS: DailyQuestProgress = {
  wordsSaved: 0,
  celebratedAt: null,
  reviewedAt: null,
  builtAt: null,
};

const todayDate = () => new Date().toISOString().split("T")[0];

// daily_quest_progress isn't in the generated Database type yet (added by
// this ship's migration, ahead of the next `supabase gen types` run) — cast
// the table name the same way the rest of the codebase already does for
// tables ahead of codegen (e.g. ContinueWatchingRail's "video_comprehension").
export async function getTodayQuestProgress(userId: string): Promise<DailyQuestProgress> {
  const { data, error } = await supabase
    .from("daily_quest_progress" as any)
    .select("words_saved, celebrated_at, reviewed_at, built_at")
    .eq("user_id", userId)
    .eq("date", todayDate())
    .maybeSingle();

  if (error) {
    console.error("[dailyQuest] failed to load today's progress", error);
    return EMPTY_PROGRESS;
  }
  if (!data) return EMPTY_PROGRESS;

  const row = data as any;
  return {
    wordsSaved: row.words_saved ?? 0,
    celebratedAt: row.celebrated_at,
    reviewedAt: row.reviewed_at,
    builtAt: row.built_at,
  };
}

/** Call once per word saved. Fire-and-forget — this only feeds a UI nudge. */
export async function incrementWordsSavedToday(userId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_words_saved_today" as any, { p_user_id: userId });
  if (error) console.error("[dailyQuest] failed to increment words saved", error);
}

async function markStage(
  userId: string,
  column: "celebrated_at" | "reviewed_at" | "built_at",
): Promise<void> {
  const { error } = await supabase
    .from("daily_quest_progress" as any)
    .upsert(
      { user_id: userId, date: todayDate(), [column]: new Date().toISOString() } as any,
      { onConflict: "user_id,date" },
    );
  if (error) console.error(`[dailyQuest] failed to mark ${column}`, error);
}

export const markQuestCelebrated = (userId: string) => markStage(userId, "celebrated_at");
export const markQuestReviewed = (userId: string) => markStage(userId, "reviewed_at");
export const markQuestBuilt = (userId: string) => markStage(userId, "built_at");

/** Save 5 (or the learner's goal) -> celebrate -> review -> build -> done. */
export function deriveQuestStage(progress: DailyQuestProgress, goal: number): QuestStage {
  if (progress.builtAt) return "done";
  if (progress.reviewedAt) return "build";
  if (progress.celebratedAt) return "review";
  if (progress.wordsSaved >= goal) return "celebrate";
  return "saving";
}
