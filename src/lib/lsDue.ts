import { supabase } from "@/integrations/supabase/client";

/**
 * One source of truth for "what's due today" in LinguaScripts, used by both
 * the home card and the LinguaScripts page so they can never disagree.
 * Everything is scoped to one language.
 */
export interface DueSummary {
  language: string;
  rows: { id: string; target_word: string; scheduled_for: string }[];
  dueIds: string[]; // all due now, oldest first
  doneToday: number;
}

const KEY = (u: string, l: string) => `ls-due:${u}:${l}`;

export function cachedDue(userId: string, language: string): DueSummary | null {
  try {
    const raw = sessionStorage.getItem(KEY(userId, language));
    return raw ? (JSON.parse(raw) as DueSummary) : null;
  } catch {
    return null;
  }
}

export async function loadDue(userId: string, language: string): Promise<DueSummary> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const weekEnd = new Date(start.getTime() + 8 * 86400000);
  const now = Date.now();

  const [all, reviews] = await Promise.all([
    supabase
      .from("linguascripts")
      .select("id, target_word, scheduled_for")
      .eq("user_id", userId)
      .eq("language", language)
      .is("completed_at", null)
      .lte("scheduled_for", weekEnd.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(1000),
    supabase
      .from("linguascript_reviews")
      .select("linguascript_id, linguascripts!inner(language)")
      .eq("user_id", userId)
      .eq("linguascripts.language", language)
      .gte("created_at", start.toISOString()),
  ]);
  if (all.error) throw all.error;

  const rows = (all.data || []) as DueSummary["rows"];
  const summary: DueSummary = {
    language,
    rows,
    dueIds: rows.filter((r) => new Date(r.scheduled_for).getTime() <= now).map((r) => r.id),
    doneToday: new Set(((reviews.data || []) as any[]).map((r) => r.linguascript_id)).size,
  };
  try {
    sessionStorage.setItem(KEY(userId, language), JSON.stringify(summary));
  } catch {
    /* storage full */
  }
  return summary;
}
