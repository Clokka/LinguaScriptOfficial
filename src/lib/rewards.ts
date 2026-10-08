// MOTIVATION LAYER — gift boxes, streak rewards, daily chest, gem shop.
// Server functions are authoritative (open_level_box, claim_streak_reward,
// claim_daily_chest, buy_shop_item). These tables only drive the UI and
// MUST match the SQL in the reward-system migration.
import { supabase } from "@/integrations/supabase/client";
import { gemsForLevel } from "@/lib/levelRewards";

/** Fixed item in each level box — mirrors public.level_box_item(). */
export const LEVEL_ITEMS: Record<number, { id: string; name: string; emoji: string }> = {
  5: { id: "sneakers", name: "Cartoon Sneakers", emoji: "👟" },
  10: { id: "colobus", name: "Colobus", emoji: "🐒" },
  15: { id: "trucker_hat", name: "Trucker Hat", emoji: "🧢" },
  20: { id: "inkfish", name: "Inkfish", emoji: "🦑" },
};

export function levelBoxContents(level: number) {
  return { level, gems: gemsForLevel(level), item: LEVEL_ITEMS[level] ?? null };
}

export const STREAK_MILESTONES = [
  { days: 3, gems: 30, item: null },
  { days: 7, gems: 75, item: { name: "Streak freeze", emoji: "🧊" } },
  { days: 14, gems: 100, item: { name: "Muskrat", emoji: "🦫" } },
  { days: 30, gems: 250, item: { name: "Streak freeze", emoji: "🧊" } },
  { days: 60, gems: 400, item: null },
  { days: 100, gems: 1000, item: { name: "Streak freeze", emoji: "🧊" } },
] as const;

export const CHEST_GEMS = [10, 15, 20, 25, 30, 40, 60];

export interface ShopItem {
  id: string;
  kind: "pet" | "accessory" | "freeze";
  name: string;
  emoji: string;
  price: number;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args ?? {});
  if (error) throw new Error(error.message);
  return data as T;
}

export const openLevelBox = (level: number) =>
  rpc<{ level: number; gems: number; item_id: string | null; already: boolean; balance: number }>(
    "open_level_box",
    { p_level: level },
  );
export const claimStreakReward = (days: number) =>
  rpc<{ gems: number; item_id: string | null; already: boolean; balance: number }>(
    "claim_streak_reward",
    { p_days: days },
  );
export const claimDailyChest = () =>
  rpc<{ gems: number; run: number; already: boolean; balance: number }>("claim_daily_chest");
export const buyShopItem = (id: string) => rpc<{ balance: number }>("buy_shop_item", { p_item: id });
export const consumeStreakFreeze = () => rpc<boolean>("use_streak_freeze");

export async function loadRewardState(userId: string) {
  const [claims, items, shop, profile] = await Promise.all([
    (supabase as any).from("reward_claims").select("kind, key").eq("user_id", userId),
    (supabase as any).from("user_items").select("item_id").eq("user_id", userId),
    (supabase as any).from("shop_items").select("*").order("sort_order"),
    (supabase as any)
      .from("profiles")
      .select("gems, streak_freezes, streak_count, xp_level")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const claimed = new Set<string>(((claims.data ?? []) as any[]).map((c) => `${c.kind}:${c.key}`));
  return {
    claimed,
    items: ((items.data ?? []) as any[]).map((r) => r.item_id as string),
    shop: (shop.data ?? []) as ShopItem[],
    gems: (profile.data?.gems as number) ?? 0,
    freezes: (profile.data?.streak_freezes as number) ?? 0,
    streak: (profile.data?.streak_count as number) ?? 0,
    level: (profile.data?.xp_level as number) ?? 1,
  };
}

export const REWARDS_CHANGED = "ls:rewards-changed";
export const emitRewardsChanged = () => window.dispatchEvent(new Event(REWARDS_CHANGED));

/** Fired the moment today's word goal (words added) is reached. */
export const DAILY_GOAL_REACHED = "linguascript:daily-goal-reached";
export const emitDailyGoalReached = () => window.dispatchEvent(new Event(DAILY_GOAL_REACHED));
