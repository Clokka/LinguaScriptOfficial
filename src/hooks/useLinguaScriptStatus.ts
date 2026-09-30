import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDailyWordGoal } from "@/hooks/useDailyWordGoal";
import { cachedDue, loadDue, type DueSummary } from "@/lib/lsDue";

export type HomeState = "linguascripts-pending" | "linguascripts-complete" | "flashcards-due";

export interface LinguaScriptStatusData {
  state: HomeState;
  linguascriptsPending: number;
  linguascriptsDueIds: string[];
  reviewedToday: number;
  flashcardsDue: number;
  nextFlashcardReviewTime?: string;
}

const EMPTY: LinguaScriptStatusData = {
  state: "linguascripts-complete",
  linguascriptsPending: 0,
  linguascriptsDueIds: [],
  reviewedToday: 0,
  flashcardsDue: 0,
};

export function useLinguaScriptStatus() {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const { goal: dailyGoal } = useDailyWordGoal(learningLanguage || undefined);
  const [status, setStatus] = useState<LinguaScriptStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const toStatus = useCallback(
    (d: DueSummary, flashcardsDue = 0): LinguaScriptStatusData => {
      // Same cap as the LinguaScripts page: never show more than what's left of today's goal.
      const remaining = Math.max(0, (dailyGoal || 0) - d.doneToday);
      const ids = d.dueIds.slice(0, remaining);
      return {
        state: ids.length > 0 ? "linguascripts-pending" : flashcardsDue > 0 ? "flashcards-due" : "linguascripts-complete",
        linguascriptsPending: ids.length,
        reviewedToday: d.doneToday,
        linguascriptsDueIds: ids.slice(0, 10),
        flashcardsDue,
      };
    },
    [dailyGoal],
  );

  const loadStatus = useCallback(async () => {
    if (!user?.id || !learningLanguage) {
      setStatus(EMPTY);
      setLoading(false);
      return;
    }
    const my = ++reqId.current;
    // Show this language's last known numbers instantly, never the previous language's.
    const cached = cachedDue(user.id, learningLanguage);
    setStatus(cached ? toStatus(cached) : null);
    setLoading(!cached);
    setError(null);
    try {
      const now = new Date().toISOString();
      const [d, fc] = await Promise.all([
        loadDue(user.id, learningLanguage),
        supabase
          .from("saved_words")
          .select("id")
          .eq("user_id", user.id)
          .eq("language", learningLanguage)
          .gte("appearance_count", 3)
          .or(`next_review_at.is.null,next_review_at.lte.${now}`)
          .limit(1),
      ]);
      if (my !== reqId.current) return; // a newer language/load superseded this one
      setStatus(toStatus(d, fc.data?.length ?? 0));
    } catch (e: any) {
      if (my !== reqId.current) return;
      console.error("[useLinguaScriptStatus] query failed:", e);
      setError(e?.message || "Failed");
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }, [user?.id, learningLanguage, toStatus]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Realtime events (a burst-sync from the extension can fire dozens in a
  // row), tab focus, and visibilitychange can all land within the same
  // tick — debounce them into one refetch instead of one query set per
  // trigger. The initial mount load above stays immediate/undebounced.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedLoadStatus = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { loadStatus(); }, 300);
  }, [loadStatus]);
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  // Realtime: any change to this user's exercises or saved words refreshes the count.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`linguascript-status-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "linguascripts", filter: `user_id=eq.${user.id}` },
        () => debouncedLoadStatus()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_words", filter: `user_id=eq.${user.id}` },
        () => debouncedLoadStatus()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "linguascript_reviews", filter: `user_id=eq.${user.id}` },
        () => debouncedLoadStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, debouncedLoadStatus]);

  // Safety net: refetch when the tab regains focus, in case a realtime frame was missed.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") debouncedLoadStatus();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [debouncedLoadStatus]);

  return { status, loading, error, refetch: loadStatus };
}
