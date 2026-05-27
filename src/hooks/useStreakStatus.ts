import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { wordGoalForVideos, minuteGoalForVideos } from "@/lib/progressStats";
import { emitStreakIgnited } from "@/components/StreakCelebrationModal";

export interface StreakStatus {
  loading: boolean;
  videoGoal: number;
  wordGoal: number;
  minuteGoal: number;
  wordsReviewed: number;
  minutesWatched: number;
  videosWatched: number;
  wordsGoalMet: boolean;
  watchGoalMet: boolean;
  streakActive: boolean; // both goals met today
  streakCount: number;
  refresh: () => Promise<void>;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

/**
 * Reads today's activity + profile goal, and lazily ignites the streak
 * (writes goal_met=true + bumps profile.streak_count) when both daily
 * targets are met. Pure read-on-mount; call `refresh()` after activity.
 */
export function useStreakStatus(): StreakStatus {
  const { user } = useAuth();
  const [state, setState] = useState<StreakStatus>({
    loading: true,
    videoGoal: 1,
    wordGoal: 10,
    minuteGoal: 10,
    wordsReviewed: 0,
    minutesWatched: 0,
    videosWatched: 0,
    wordsGoalMet: false,
    watchGoalMet: false,
    streakActive: false,
    streakCount: 0,
    refresh: async () => {},
  });

  const load = useCallback(async () => {
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const today = todayStr();

    const [{ data: profile }, { data: activity }] = await Promise.all([
      supabase
        .from("profiles")
        .select("daily_video_goal, daily_word_goal, streak_count, last_streak_date")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("activity_log")
        .select("minutes_watched, videos_watched, words_reviewed, goal_met")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
    ]);

    const videoGoal = (profile as any)?.daily_video_goal ?? 1;
    const wordGoal = (profile as any)?.daily_word_goal ?? wordGoalForVideos(videoGoal);
    const minuteGoal = minuteGoalForVideos(videoGoal);

    const wordsReviewed = (activity as any)?.words_reviewed ?? 0;
    const minutesWatched = (activity as any)?.minutes_watched ?? 0;
    const videosWatched = (activity as any)?.videos_watched ?? 0;

    const wordsGoalMet = wordsReviewed >= wordGoal;
    const watchGoalMet = minutesWatched >= minuteGoal;
    const bothMet = wordsGoalMet && watchGoalMet;
    let streakCount = (profile as any)?.streak_count ?? 0;
    const lastStreakDate: string | null = (profile as any)?.last_streak_date ?? null;
    const alreadyMarkedToday = (activity as any)?.goal_met === true;

    // Ignite streak lazily once both goals are met
    if (bothMet && !alreadyMarkedToday) {
      const continuing = lastStreakDate === yesterdayStr();
      const sameDay = lastStreakDate === today;
      const newCount = sameDay ? streakCount : continuing ? streakCount + 1 : 1;

      // Upsert today's activity_log row with goal_met=true
      await supabase
        .from("activity_log")
        .upsert(
          {
            user_id: user.id,
            date: today,
            minutes_watched: minutesWatched,
            videos_watched: videosWatched,
            words_reviewed: wordsReviewed,
            goal_met: true,
          },
          { onConflict: "user_id,date" },
        );

      await supabase
        .from("profiles")
        .update({ streak_count: newCount, last_streak_date: today } as any)
        .eq("user_id", user.id);
      streakCount = newCount;

      // Fire celebration event (once per ignition, guarded by alreadyMarkedToday above)
      emitStreakIgnited({
        streakCount: newCount,
        wordsReviewed,
        minutesWatched,
      });
    }

    setState({
      loading: false,
      videoGoal,
      wordGoal,
      minuteGoal,
      wordsReviewed,
      minutesWatched,
      videosWatched,
      wordsGoalMet,
      watchGoalMet,
      streakActive: bothMet,
      streakCount,
      refresh: load,
    });
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
