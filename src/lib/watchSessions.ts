// Per-watch session tracking — every viewing is one row.
// Uses an RPC so the comprehension aggregate update + session insert
// happen in one round trip.
import { supabase } from "@/integrations/supabase/client";
import type { VideoComprehension } from "@/lib/videoComprehension";

export interface WatchSession {
  id: string;
  film_id: string;
  language: string;
  watch_number: number;
  comprehension_pct: number;
  prev_comprehension_pct: number | null;
  delta: number;
  green_count: number;
  orange_count: number;
  red_count: number;
  total_tokens: number;
  duration_watched_seconds: number;
  completion_pct: number;
  watched_at: string;
}

export interface RecordResult {
  watch_number: number;
  prev_pct: number | null;
  new_pct: number;
  delta: number;
  first_pct: number;
  best_pct: number;
}

export async function recordWatchSession(
  filmId: string,
  language: string,
  c: VideoComprehension,
  durationSeconds: number,
  completionPct: number,
): Promise<RecordResult | null> {
  const { data, error } = await supabase.rpc("record_watch_session" as any, {
    _film_id: filmId,
    _language: language,
    _comprehension: c.pct,
    _green: c.greenCount,
    _orange: c.orangeCount,
    _red: c.redCount,
    _total_tokens: c.totalTokens,
    _duration_seconds: Math.max(0, Math.floor(durationSeconds || 0)),
    _completion_pct: Math.max(0, Math.min(100, completionPct || 0)),
  });
  if (error) {
    console.error("record_watch_session failed:", error);
    return null;
  }
  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
  if (!row) return null;
  return {
    watch_number: Number(row.watch_number),
    prev_pct: row.prev_pct === null ? null : Number(row.prev_pct),
    new_pct: Number(row.new_pct),
    delta: Number(row.delta),
    first_pct: Number(row.first_pct),
    best_pct: Number(row.best_pct),
  };
}

export async function fetchFilmSessions(filmId: string, limit = 20): Promise<WatchSession[]> {
  const { data, error } = await supabase
    .from("watch_sessions" as any)
    .select("*")
    .eq("film_id", filmId)
    .order("watch_number", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    ...r,
    comprehension_pct: Number(r.comprehension_pct),
    prev_comprehension_pct: r.prev_comprehension_pct === null ? null : Number(r.prev_comprehension_pct),
    delta: Number(r.delta),
  }));
}

export interface DashboardStats {
  avg_comprehension: number;
  highest_comprehension: number;
  avg_gain_per_watch: number;
  videos_mastered: number;
  videos_in_progress: number;
  total_minutes: number;
  vocab_learned: number;
}

export async function fetchProgressStats(): Promise<DashboardStats | null> {
  const { data, error } = await supabase.rpc("user_progress_stats" as any);
  if (error) {
    console.error("user_progress_stats failed:", error);
    return null;
  }
  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
  if (!row) return null;
  return {
    avg_comprehension: Number(row.avg_comprehension),
    highest_comprehension: Number(row.highest_comprehension),
    avg_gain_per_watch: Number(row.avg_gain_per_watch),
    videos_mastered: Number(row.videos_mastered),
    videos_in_progress: Number(row.videos_in_progress),
    total_minutes: Number(row.total_minutes),
    vocab_learned: Number(row.vocab_learned),
  };
}

export async function fetchLearningRate(language: string): Promise<number> {
  const { data, error } = await supabase.rpc("user_learning_rate" as any, { _language: language });
  if (error) return 0;
  return Number(data ?? 0);
}
