import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXp } from "@/contexts/XpContext";
import { emitRewardsChanged, LEVEL_ITEMS, openLevelBox } from "@/lib/rewards";
import { checkPetMilestones } from "@/lib/pets";
import { GiftBoxReveal, type GiftContents } from "./GiftBoxReveal";

/** Marks a full-screen celebration (e.g. the streak screen) the gift waits behind. */
export const CELEBRATION_ATTR = "data-celebration-open";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The present is earned by levelling up — real work, not just showing up.
 * When a level-up's celebration finishes (XpContext clears leveledUpTo), the
 * level's gift box appears full-screen and the learner taps it open
 * (open_level_box: that level's gems, plus an item at levels 5/10/15/20).
 * It waits for any other full-screen celebration to close first, and each
 * level's box opens once. Mount once at the app root.
 */
export function LevelUpGift() {
  const { user } = useAuth();
  const { leveledUpTo } = useXp();
  const pendingRef = useRef<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [gift, setGift] = useState<GiftContents | null>(null);

  // Remember the level while its celebration plays; act once it's cleared.
  useEffect(() => {
    if (leveledUpTo != null) {
      pendingRef.current = Math.max(pendingRef.current ?? 0, leveledUpTo);
      return;
    }
    const lvl = pendingRef.current;
    if (lvl == null || !user || lvl < 2) return;
    pendingRef.current = null;
    let cancelled = false;
    (async () => {
      while (!cancelled && document.querySelector(`[${CELEBRATION_ATTR}]`)) await wait(500);
      const { data } = await supabase
        .from("reward_claims").select("id")
        .eq("user_id", user.id).eq("kind", "level").eq("key", String(lvl))
        .maybeSingle();
      if (cancelled || data) return;
      setLevel(lvl);
      setGift({ title: `Level ${lvl}`, gems: 0 });
    })();
    return () => { cancelled = true; };
  }, [leveledUpTo, user]);

  return (
    <GiftBoxReveal
      open={!!gift}
      onClose={() => {
        setGift(null);
        setLevel(null);
        checkPetMilestones();
      }}
      contents={gift}
      onOpen={async () => {
        if (level == null || !user) return;
        // Only name the item if this box is really giving it: a pet or
        // accessory the learner already owns (e.g. bought with gems) isn't new,
        // so the reveal shows just the gems.
        const boxItem = LEVEL_ITEMS[level] ?? null;
        let alreadyOwned = false;
        if (boxItem) {
          const [{ count: pets }, { count: items }] = await Promise.all([
            supabase.from("pet_collection").select("id", { count: "exact", head: true })
              .eq("user_id", user.id).eq("pet_id", boxItem.id),
            supabase.from("user_items").select("id", { count: "exact", head: true })
              .eq("user_id", user.id).eq("item_id", boxItem.id),
          ]);
          alreadyOwned = (pets ?? 0) + (items ?? 0) > 0;
        }
        // The new level reaches the profile a moment after the animation
        // starts; give the save a second chance before giving up.
        let r;
        try {
          r = await openLevelBox(level);
        } catch {
          await wait(1500);
          r = await openLevelBox(level);
        }
        const item = r.item_id && !r.already && !alreadyOwned ? boxItem : null;
        setGift({ title: `Level ${level}`, gems: r.gems, item: item && { name: item.name, emoji: item.emoji } });
        emitRewardsChanged();
      }}
    />
  );
}
