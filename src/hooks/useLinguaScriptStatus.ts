import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

export type HomeState = "linguascripts-pending" | "linguascripts-complete" | "flashcards-due";

export interface LinguaScriptStatusData {
  state: HomeState;
  linguascriptsPending: number;
  linguascriptsDueIds: string[];
  flashcardsDue: number;
  nextFlashcardReviewTime?: string;
}

const EMPTY: LinguaScriptStatusData = {
  state: "linguascripts-complete",
  linguascriptsPending: 0,
  linguascriptsDueIds: [],
  flashcardsDue: 0,
};

export function useLinguaScriptStatus() {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const [status, setStatus] = useState<LinguaScriptStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!user?.id || !learningLanguage) {
      setStatus(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const now = new Date().toISOString();

    // Exact count of due exercises (no row cap).
    const { count, error: countError } = await supabase
      .from("linguascripts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("language", learningLanguage)
      .lte("scheduled_for", now)
      .is("completed_at", null);

    // First batch of IDs, used to seed a practice session.
    const { data: dueRows, error: idsError } = await supabase
      .from("linguascripts")
      .select("id")
      .eq("user_id", user.id)
      .eq("language", learningLanguage)
      .lte("scheduled_for", now)
      .is("completed_at", null)
      .order("scheduled_for", { ascending: true })
      .limit(10);

    const { data: flashcards, error: fcError } = await supabase
      .from("saved_words")
      .select("id, last_reviewed_at")
      .eq("user_id", user.id)
      .eq("language", learningLanguage)
      .gte("appearance_count", 3)
      .or(`next_review_at.is.null,next_review_at.lte.${now}`)
      .limit(1);

    const firstError = countError || idsError || fcError;
    if (firstError) {
      // Surface the failure instead of silently reporting zero.
      console.error("[useLinguaScriptStatus] query failed:", firstError);
      setError(firstError.message);
    }

    const pending = count ?? 0;
    const flashcardsDue = flashcards?.length ?? 0;

    setStatus({
      state:
        pending > 0
          ? "linguascripts-pending"
          : flashcardsDue > 0
            ? "flashcards-due"
            : "linguascripts-complete",
      linguascriptsPending: pending,
      linguascriptsDueIds: (dueRows ?? []).map((r) => r.id),
      flashcardsDue,
      nextFlashcardReviewTime: flashcards?.[0]?.last_reviewed_at ?? undefined,
    });
    setLoading(false);
  }, [user?.id, learningLanguage]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Realtime: any change to this user's exercises or saved words refreshes the count.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`linguascript-status-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "linguascripts", filter: `user_id=eq.${user.id}` },
        () => loadStatus()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_words", filter: `user_id=eq.${user.id}` },
        () => loadStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadStatus]);

  // Safety net: refetch when the tab regains focus, in case a realtime frame was missed.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") loadStatus();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadStatus]);

  return { status, loading, error, refetch: loadStatus };
}
