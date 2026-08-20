import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeWordGoal, DEFAULT_WORD_GOAL } from "@/lib/progressStats";
import {
  deriveQuestStage,
  getTodayQuestProgress,
  markQuestBuilt,
  markQuestCelebrated,
  markQuestReviewed,
  type DailyQuestProgress,
  type QuestStage,
} from "@/lib/dailyQuest";

export interface DailyQuest {
  stage: QuestStage;
  progress: DailyQuestProgress;
  goal: number;
  loading: boolean;
  celebrate: () => Promise<void>;
  markReviewed: () => Promise<void>;
  markBuilt: () => Promise<void>;
  refresh: () => Promise<void>;
}

const EMPTY_PROGRESS: DailyQuestProgress = {
  wordsSaved: 0,
  celebratedAt: null,
  reviewedAt: null,
  builtAt: null,
};

/** Save N words -> celebrate -> review -> build, tracked across the day. */
export function useDailyQuest(): DailyQuest {
  const { user } = useAuth();
  const [progress, setProgress] = useState<DailyQuestProgress>(EMPTY_PROGRESS);
  const [goal, setGoal] = useState(DEFAULT_WORD_GOAL);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const [nextProgress, { data: profile }] = await Promise.all([
      getTodayQuestProgress(user.id),
      supabase.from("profiles").select("daily_word_goal").eq("user_id", user.id).maybeSingle(),
    ]);
    setProgress(nextProgress);
    setGoal(normalizeWordGoal((profile as any)?.daily_word_goal));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Words saved during video playback land here in near-real-time, so the
  // quest card advances without the learner needing to leave Watch and come
  // back.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`daily-quest-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_quest_progress", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const celebrate = useCallback(async () => {
    if (!user) return;
    await markQuestCelebrated(user.id);
    await refresh();
  }, [user, refresh]);

  const markReviewed = useCallback(async () => {
    if (!user) return;
    await markQuestReviewed(user.id);
    await refresh();
  }, [user, refresh]);

  const markBuilt = useCallback(async () => {
    if (!user) return;
    await markQuestBuilt(user.id);
    await refresh();
  }, [user, refresh]);

  return {
    stage: deriveQuestStage(progress, goal),
    progress,
    goal,
    loading,
    celebrate,
    markReviewed,
    markBuilt,
    refresh,
  };
}
