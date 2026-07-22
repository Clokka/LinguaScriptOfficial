import { useCallback } from "react";
import { useAuth } from "./useAuth";

type AwardType = "review_card" | "milestone" | "streak";

interface AwardOptions {
  correct?: boolean;
  combo?: number;
  difficulty?: "easy" | "medium" | "hard";
}

export function useXp() {
  const { user } = useAuth();

  const award = useCallback(
    async (type: AwardType, options: AwardOptions = {}) => {
      if (!user) return;

      // Calculate XP based on type and options
      let xp = 0;
      switch (type) {
        case "review_card":
          xp = options.correct ? 15 : 5;
          if (options.combo && options.combo > 1) {
            xp = Math.floor(xp * (1 + options.combo * 0.1));
          }
          break;
        case "milestone":
          xp = 50;
          break;
        case "streak":
          xp = 30;
          break;
      }

      // TODO: Save to database when profiles.xp_balance is ready
      console.log(`[XP] Awarded ${xp}XP for ${type}`, options);
    },
    [user]
  );

  return { award };
}
