// Daily activity is kept per language: one activity_log row per
// (user, day, language), so watching Chinese never uses up Japanese minutes or
// words. The 🔥 streak and the calendars stay account-wide by merging a day's
// rows (mergeActivityByDate).
import { supabase } from "@/integrations/supabase/client";

export type ActivityCounter = "minutes_watched" | "videos_watched" | "words_reviewed";

/** Adds to today's counters for one language, creating the row if needed. */
export async function bumpActivity(
  userId: string,
  language: string,
  add: Partial<Record<ActivityCounter, number>>,
): Promise<void> {
  const lang = (language || "").toLowerCase();
  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await supabase
    .from("activity_log")
    .select("id, minutes_watched, videos_watched, words_reviewed")
    .eq("user_id", userId)
    .eq("date", today)
    .eq("language", lang)
    .maybeSingle();
  if (existing) {
    const patch: Partial<Record<ActivityCounter, number>> = {};
    for (const k of Object.keys(add) as ActivityCounter[]) patch[k] = (existing[k] || 0) + (add[k] || 0);
    await supabase.from("activity_log").update(patch).eq("id", existing.id);
  } else {
    await supabase.from("activity_log").insert({
      user_id: userId,
      date: today,
      language: lang,
      minutes_watched: add.minutes_watched ?? 0,
      videos_watched: add.videos_watched ?? 0,
      words_reviewed: add.words_reviewed ?? 0,
    });
  }
}

interface DayRow {
  date: string;
  minutes_watched?: number | null;
  videos_watched?: number | null;
  words_reviewed?: number | null;
  goal_met?: boolean | null;
}

/** One entry per day across all languages: counters summed, goal met if any language met it. */
export function mergeActivityByDate<T extends DayRow>(rows: T[]): T[] {
  const byDate = new Map<string, T>();
  for (const r of rows) {
    const prev = byDate.get(r.date);
    if (!prev) {
      byDate.set(r.date, { ...r });
      continue;
    }
    byDate.set(r.date, {
      ...prev,
      minutes_watched: (prev.minutes_watched || 0) + (r.minutes_watched || 0),
      videos_watched: (prev.videos_watched || 0) + (r.videos_watched || 0),
      words_reviewed: (prev.words_reviewed || 0) + (r.words_reviewed || 0),
      goal_met: !!(prev.goal_met || r.goal_met),
    });
  }
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}
