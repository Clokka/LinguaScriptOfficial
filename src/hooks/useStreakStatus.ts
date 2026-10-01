import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXp } from "@/contexts/XpContext";
import { DEFAULT_WORD_GOAL, wordGoalForVideos, minuteGoalForVideos } from "@/lib/progressStats";
import { keepStreak, STREAK_EVENT } from "@/lib/streak";
import { dailyGoalSpikeIntensity } from "@/lib/dailyGoalSpike";

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
  /**
   * True once today's WORD goal is met. Watch time is reported but does not
   * gate this: the learner chose a word goal, and that is the promise the app
   * has to keep. Requiring minutes as well made a 1-word goal meaningless,
   * because the streak still demanded ten to thirty minutes of video.
   */
  streakActive: boolean;
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
  const { award } = useXp();
  const [state, setState] = useState<StreakStatus>({
    loading: true,
    videoGoal: 1,
    wordGoal: DEFAULT_WORD_GOAL,
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
    const wordGoal =
      (profile as any)?.daily_word_goal ?? wordGoalForVideos(videoGoal);
    const minuteGoal = minuteGoalForVideos(videoGoal);

    const wordsReviewed = (activity as any)?.words_reviewed ?? 0;
    const minutesWatched = (activity as any)?.minutes_watched ?? 0;
    const videosWatched = (activity as any)?.videos_watched ?? 0;

    const wordsGoalMet = wordsReviewed >= wordGoal;
    const watchGoalMet = minutesWatched >= minuteGoal;
    // The word goal alone ignites the streak. watchGoalMet is still surfaced so
    // the UI can celebrate it, but it is a bonus and never a second, hidden
    // goal the learner never agreed to.
    // Streak is kept server-side by one real learning action (keep_streak);
    // the daily goal is the mission and pays the guaranteed level-up.
    let streakCount = (profile as any)?.streak_count ?? 0;
    const sr = await keepStreak();
    let streakKept = false;
    if (sr) { streakCount = sr.streak; streakKept = sr.kept; }
    const alreadyMarkedToday = (activity as any)?.goal_met === true;
    if (wordsGoalMet && !alreadyMarkedToday) {
      await supabase.from("activity_log").upsert(
        { user_id: user.id, date: today, minutes_watched: minutesWatched, videos_watched: videosWatched, words_reviewed: wordsReviewed, goal_met: true },
        { onConflict: "user_id,date" },
      );
      award("daily_goal_reached", { intensity: dailyGoalSpikeIntensity(streakCount) });
    }
    const streakEarned = streakKept;

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
      streakActive: streakEarned,
      streakCount,
      refresh: load,
    });
  }, [user]);

  useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener(STREAK_EVENT, on);
    return () => window.removeEventListener(STREAK_EVENT, on);
  }, [load]);

  return { ...state, refresh: load };
}
