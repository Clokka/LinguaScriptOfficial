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

      // Count LinguaScripts ready for review
      // These are saved_words that should appear in today's session
      // For MVP: words with appearance_count < 3 and capture_date is today or earlier
      const { data: linguascripts, error: lsError } = await supabase
        .from("saved_words")
        .select("id")
        .eq("user_id", user?.id)
        .eq("language", learningLanguage)
        .is("appearance_count", null)
        .or("appearance_count.lt.3")
        .lte("created_at", new Date().toISOString())
        .limit(20);

      if (lsError) throw lsError;

      const linguaScriptsPending = linguascripts?.length || 0;
      const dueIds = linguascripts?.map((w) => w.id) || [];

      // Count flashcards due (for next review alert)
      // These are words that have already appeared in LinguaScripts
      // and are due for spaced repetition
      const { data: flashcards, error: fcError } = await supabase
        .from("saved_words")
        .select("id, last_reviewed_at")
        .eq("user_id", user?.id)
        .eq("language", learningLanguage)
        .gt("appearance_count", 2)
        .lte("next_review_at", new Date().toISOString());

      if (fcError) throw fcError;

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
      console.error("[useLinguaScriptStatus] Error:", err);
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
