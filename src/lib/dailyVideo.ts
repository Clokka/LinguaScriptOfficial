// MOTIVATION LAYER — daily featured video (non-blocking).
import { supabase } from "@/integrations/supabase/client";

export function todayKey() {
  return new Date().toISOString().split("T")[0];
}

/** Deterministically pick today's featured film for this user. */
export function pickFeaturedFilmId(filmIds: string[], userId: string | null): string | null {
  if (filmIds.length === 0) return null;
  const seed = `${todayKey()}::${userId ?? "guest"}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % filmIds.length;
  return filmIds[idx];
}

/** Mark today's video as watched (best-effort, fire-and-forget). */
export async function recordDailyVideoWatch(userId: string, filmId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({
      video_credit_date: todayKey(),
      last_video_id: filmId,
    } as any)
    .eq("user_id", userId);
  if (error) console.error("[dailyVideo] update failed", error);
}

const REINFORCE_KEY = "linguascript.reinforcementPending";

export function setReinforcementPending() {
  try { sessionStorage.setItem(REINFORCE_KEY, "1"); } catch { /* noop */ }
}

export function consumeReinforcementPending(): boolean {
  try {
    const v = sessionStorage.getItem(REINFORCE_KEY);
    if (v) sessionStorage.removeItem(REINFORCE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}
