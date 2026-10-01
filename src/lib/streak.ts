// Streak = consistency. Kept by ONE real learning action today (1 card,
// 1 LinguaScript item, 1 minute of video) — checked server-side by
// keep_streak(). Opening the app alone never keeps it.
import { supabase } from "@/integrations/supabase/client";
import { emitStreakIgnited } from "@/components/StreakCelebrationModal";
import { toast } from "@/hooks/use-toast";

export interface StreakResult { streak: number; kept: boolean; already?: boolean; freeze_used?: boolean }

export const STREAK_EVENT = "ls:streak-changed";
let inflight: Promise<StreakResult | null> | null = null;
let keptToday: string | null = null;

const localDay = () => new Date().toLocaleDateString("en-CA");

export async function keepStreak(): Promise<StreakResult | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await (supabase as any).rpc("keep_streak");
    if (error) return null;
    const r = data as StreakResult;
    if (r.kept && !r.already) {
      if (r.freeze_used) toast({ title: "🧊 Streak freeze used", description: `Your streak is safe.` });
      emitStreakIgnited({ streakCount: r.streak, wordsReviewed: 0, minutesWatched: 0 });
      void checkAchievements();
    }
    if (r.kept) keptToday = localDay();
    window.dispatchEvent(new CustomEvent(STREAK_EVENT, { detail: r }));
    return r;
  })().finally(() => { setTimeout(() => { inflight = null; }, 0); });
  return inflight;
}

/** Call after any genuine learning action. Waits for the XP event to land first. */
export function noteLearningActivity() {
  if (keptToday === localDay()) return;
  setTimeout(() => { void keepStreak(); }, 1500);
}

export async function checkAchievements(language?: string) {
  const { data } = await (supabase as any).rpc("check_achievements", { p_language: language ?? null });
  const ids: string[] = (data as any)?.granted ?? [];
  if (!ids.length) return;
  const { data: items } = await (supabase as any).from("shop_items").select("id,name,emoji,description").in("id", ids);
  for (const it of (items as any[]) || []) {
    toast({ title: `${it.emoji} Unlocked: ${it.name}`, description: it.description || "New cosmetic for your chameleon" });
  }
  window.dispatchEvent(new Event("ls:rewards-changed"));
}

/** Store the device time zone so "today" follows the learner's own clock. */
export async function syncTimezone(userId: string) {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) await supabase.from("profiles").update({ timezone: tz } as any).eq("user_id", userId);
  } catch { /* ignore */ }
}
