import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXp } from "@/contexts/XpContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DEFAULT_WORD_GOAL, wordGoalForVideos, minuteGoalForVideos } from "@/lib/progressStats";
import { emitStreakIgnited } from "@/components/StreakCelebrationModal";
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
 * Reads today's activity + goal for the language being learned, and lazily
 * ignites the streak (writes goal_met=true on that language's row + bumps
 * profile.streak_count) when its word goal is met. Goals and counters are per
 * language; the streak is account-wide, so meeting any language's goal keeps
 * it alive. Pure read-on-mount; call `refresh()` after activity.
 */
export function useStreakStatus(): StreakStatus {
  const { user } = useAuth();
  const { award } = useXp();
  const { learningLanguage } = useLanguage();
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
    const lang = (learningLanguage || "").toLowerCase();

    const [{ data: profile }, { data: activity }, { data: langProfile }] = await Promise.all([
      supabase
        .from("profiles")
        .select("daily_video_goal, daily_word_goal, streak_count, last_streak_date")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("activity_log")
        .select("id, minutes_watched, videos_watched, words_reviewed, goal_met")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("language", lang)
        .maybeSingle(),
      lang
        ? supabase
            .from("language_profiles")
            .select("daily_word_goal, daily_video_goal")
            .eq("user_id", user.id)
            .eq("language", lang)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // This language's own goal first, then the account default.
    const lp = langProfile;
    const videoGoal = lp?.daily_video_goal ?? (profile as any)?.daily_video_goal ?? 1;
    const wordGoal =
      lp?.daily_word_goal ?? (profile as any)?.daily_word_goal ?? wordGoalForVideos(videoGoal);
    const minuteGoal = minuteGoalForVideos(videoGoal);

    const wordsReviewed = (activity as any)?.words_reviewed ?? 0;
    const minutesWatched = (activity as any)?.minutes_watched ?? 0;
    const videosWatched = (activity as any)?.videos_watched ?? 0;

    const wordsGoalMet = wordsReviewed >= wordGoal;
    const watchGoalMet = minutesWatched >= minuteGoal;
    // The word goal alone ignites the streak. watchGoalMet is still surfaced so
    // the UI can celebrate it, but it is a bonus and never a second, hidden
    // goal the learner never agreed to.
    const streakEarned = wordsGoalMet;
    let streakCount = (profile as any)?.streak_count ?? 0;
    const lastStreakDate: string | null = (profile as any)?.last_streak_date ?? null;
    const alreadyMarkedToday = (activity as any)?.goal_met === true;

    // Ignite streak lazily once both goals are met
    if (streakEarned && !alreadyMarkedToday) {
      const continuing = lastStreakDate === yesterdayStr();
      const sameDay = lastStreakDate === today;
      const newCount = sameDay ? streakCount : continuing ? streakCount + 1 : 1;

      // Mark today's row for this language goal_met=true.
      if (activity?.id) {
        await supabase.from("activity_log").update({ goal_met: true }).eq("id", activity.id);
      } else {
        await supabase.from("activity_log").insert({
          user_id: user.id,
          date: today,
          language: lang,
          minutes_watched: minutesWatched,
          videos_watched: videosWatched,
          words_reviewed: wordsReviewed,
          goal_met: true,
        });
      }

      await supabase
        .from("profiles")
        .update({ streak_count: newCount, last_streak_date: today } as any)
        .eq("user_id", user.id);
      streakCount = newCount;

      // Fire the streak celebration once a day — a second language meeting
      // its goal the same day doesn't change the streak.
      if (!sameDay) emitStreakIgnited({
        streakCount: newCount,
        wordsReviewed,
        minutesWatched,
      });

      // Reaching today's word goal is a guaranteed level-up (see
      // XpContext.award's daily_goal_reached case) — the whole point is that
      // whatever goal the learner picked, 1 word or 20, hitting it always
      // pays off the same way. Intensity is cosmetic only, never the reward.
      award("daily_goal_reached", { intensity: dailyGoalSpikeIntensity(newCount) });
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
      streakActive: streakEarned,
      streakCount,
      refresh: load,
    });
  }, [user, learningLanguage]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
