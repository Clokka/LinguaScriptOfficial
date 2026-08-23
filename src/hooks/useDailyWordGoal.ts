import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { wordGoalForVideos } from "@/lib/progressStats";

/**
 * The day's small, sustainable target: how many words the learner committed to
 * saving today, and how many they actually have.
 *
 * The whole loop hangs off this — the live tally while watching, and the gentle
 * "go review your LinguaScripts" nudge the moment the goal is met.
 */
export function useDailyWordGoal(language?: string) {
  const { user } = useAuth();
  const [goal, setGoal] = useState(5);
  const [savedToday, setSavedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [{ data: profile }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select("daily_word_goal, daily_video_goal")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("saved_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfDay.toISOString()),
    ]);

    const p = profile as any;
    setGoal(p?.daily_word_goal ?? wordGoalForVideos(p?.daily_video_goal ?? 1));
    setSavedToday(count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh, language]);

  /** Optimistic bump for the moment a word is saved, before the refetch lands. */
  const bump = useCallback(() => setSavedToday((n) => n + 1), []);

  return {
    goal,
    savedToday,
    reached: savedToday >= goal,
    loading,
    refresh,
    bump,
  };
}
