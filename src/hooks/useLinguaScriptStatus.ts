import { useState, useEffect } from "react";
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

export function useLinguaScriptStatus() {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const [status, setStatus] = useState<LinguaScriptStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !learningLanguage) {
      setLoading(false);
      return;
    }
    loadStatus();
  }, [user, learningLanguage]);

  async function loadStatus() {
    try {
      setLoading(true);

      // LinguaScripts ready for review: exercises where scheduled_for <= now and not completed
      const now = new Date().toISOString();
      const { data: linguascripts, error: lsError } = await supabase
        .from("linguascripts")
        .select("id")
        .eq("user_id", user?.id)
        .eq("language", learningLanguage)
        .lte("scheduled_for", now)
        .is("completed_at", null)
        .order("scheduled_for", { ascending: true })
        .limit(10);

      if (lsError) {
        console.warn("[useLinguaScriptStatus] LinguaScripts query failed:", lsError);
        // Gracefully degrade if columns don't exist yet
      }

      const linguaScriptsPending = linguascripts?.length || 0;
      const dueIds = linguascripts?.map((w: any) => w.id) || [];

      // Flashcards due: words with appearance_count >= 3 and next_review_at <= now
      const { data: flashcards, error: fcError } = await supabase
        .from("saved_words")
        .select("id, last_reviewed_at")
        .eq("user_id", user?.id)
        .eq("language", learningLanguage)
        .gte("appearance_count", 3)
        .or(`next_review_at.is.null,next_review_at.lte.${new Date().toISOString()}`)
        .limit(1);

      if (fcError) {
        console.warn("[useLinguaScriptStatus] Flashcards query failed:", fcError);
      }

      const flashcardsDue = flashcards?.length || 0;

      // Determine state
      let homeState: HomeState;
      if (linguaScriptsPending > 0) {
        homeState = "linguascripts-pending";
      } else if (flashcardsDue > 0) {
        homeState = "flashcards-due";
      } else {
        homeState = "linguascripts-complete";
      }

      setStatus({
        state: homeState,
        linguascriptsPending,
        linguascriptsDueIds: dueIds,
        flashcardsDue,
        nextFlashcardReviewTime: flashcards?.[0]?.last_reviewed_at,
      });
    } catch (err) {
      console.error("[useLinguaScriptStatus] Fatal error:", err);
      // Fallback: show nothing if queries fail (e.g., columns don't exist yet)
      setStatus({
        state: "linguascripts-complete",
        linguascriptsPending: 0,
        linguascriptsDueIds: [],
        flashcardsDue: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return { status, loading, refetch: loadStatus };
}
