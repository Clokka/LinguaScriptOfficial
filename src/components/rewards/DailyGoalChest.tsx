import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePet } from "@/contexts/PetContext";
import { claimDailyChest, emitRewardsChanged, DAILY_GOAL_REACHED } from "@/lib/rewards";
import { checkPetMilestones } from "@/lib/pets";
import { GiftBoxReveal, type GiftContents } from "./GiftBoxReveal";

/**
 * The reward for reaching today's word goal: the moment the learner adds
 * their last word, the 3D chest appears full-screen and they tap it open.
 * Once a day (claim_daily_chest is idempotent). Mount once at the app root.
 */
export function DailyGoalChest() {
  const { user } = useAuth();
  const { triggerReaction } = usePet();
  const [chest, setChest] = useState<GiftContents | null>(null);

  useEffect(() => {
    if (!user) return;
    const handler = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("reward_claims").select("id")
        .eq("user_id", user.id).eq("kind", "daily").eq("key", today)
        .maybeSingle();
      if (data) return;
      setChest({ title: "Daily chest", gems: 0 });
      triggerReaction("excited", 3000);
    };
    window.addEventListener(DAILY_GOAL_REACHED, handler);
    return () => window.removeEventListener(DAILY_GOAL_REACHED, handler);
  }, [user, triggerReaction]);

  return (
    <GiftBoxReveal
      open={!!chest}
      onClose={() => {
        setChest(null);
        checkPetMilestones();
      }}
      contents={chest}
      onOpen={async () => {
        const r = await claimDailyChest();
        setChest({ title: `${r.run} day${r.run === 1 ? "" : "s"} in a row`, gems: r.gems });
        emitRewardsChanged();
      }}
    />
  );
}
