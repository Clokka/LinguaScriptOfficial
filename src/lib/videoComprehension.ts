// Per-video comprehension: how much of THIS video does the learner understand?
//
// Computes a weighted % over every subtitle token. Green = full credit,
// Orange = half credit ("partial weight"), Red/unknown = no credit. Function
// words use the same low-weight model as `understanding.ts` so "le / la / de"
// don't inflate the score.
import { supabase } from "@/integrations/supabase/client";
import { normalizeToken, tokenWeight, tokenize } from "@/lib/understanding";
import { loadDeckIndex, type SavedWordLite, type DeckState } from "@/lib/vocab";

export interface VideoComprehension {
  pct: number;            // 0–100 weighted comprehension
  greenCount: number;
  orangeCount: number;
  redCount: number;       // tokens neither green nor orange in user's deck
  totalTokens: number;
  potentialPct: number;   // pct if every orange word becomes green
}

const ORANGE_WEIGHT = 0.5;

/** Fetch every stored subtitle line for a film+language, in any order. */
async function fetchSubtitleTokens(filmId: string, language: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("subtitles")
    .select("text")
    .eq("film_id", filmId)
    .eq("language", language);
  if (error || !data) return [];
  const all: string[] = [];
  for (const row of data as any[]) {
    for (const tok of tokenize(row.text || "")) all.push(tok);
  }
  return all;
}

export function scoreTokens(
  tokens: string[],
  language: string,
  deck: Map<string, SavedWordLite>,
): VideoComprehension {
  let totalW = 0;
  let knownW = 0;
  let potentialW = 0;
  let greenCount = 0;
  let orangeCount = 0;
  let redCount = 0;
  for (const t of tokens) {
    const w = tokenWeight(t, language);
    totalW += w;
    const state: DeckState | undefined = deck.get(normalizeToken(t))?.state;
    if (state === "green") {
      knownW += w;
      potentialW += w;
      greenCount++;
    } else if (state === "orange") {
      knownW += w * ORANGE_WEIGHT;
      potentialW += w; // promotion to green captures full weight
      orangeCount++;
    } else {
      redCount++;
    }
  }
  const pct = totalW > 0 ? Math.round((knownW / totalW) * 100) : 0;
  const potentialPct = totalW > 0 ? Math.round((potentialW / totalW) * 100) : 0;
  return {
    pct,
    greenCount,
    orangeCount,
    redCount,
    totalTokens: tokens.length,
    potentialPct,
  };
}

/** Compute comprehension for a film using the user's current deck. */
export async function computeVideoComprehension(
  userId: string | null,
  filmId: string,
  language: string,
): Promise<VideoComprehension> {
  const [tokens, deck] = await Promise.all([
    fetchSubtitleTokens(filmId, language),
    loadDeckIndex(userId, language),
  ]);
  return scoreTokens(tokens, language, deck);
}

export interface ComprehensionRecord {
  id: string;
  user_id: string;
  content_type: "film" | "lesson";
  content_id: string;
  language: string;
  first_score: number;
  latest_score: number;
  green_count: number;
  orange_count: number;
  red_count: number;
  total_tokens: number;
  first_watched_at: string;
  last_watched_at: string;
}

export async function loadComprehensionRecord(
  userId: string,
  contentId: string,
  contentType: "film" | "lesson" = "film",
): Promise<ComprehensionRecord | null> {
  const { data } = await supabase
    .from("video_comprehension" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("content_id", contentId)
    .eq("content_type", contentType)
    .maybeSingle();
  return (data as any) || null;
}

/**
 * Persist comprehension after a watch. first_score is only set on the
 * first insert so the "Previous Understanding" baseline is preserved.
 */
export async function recordComprehension(
  userId: string,
  contentId: string,
  contentType: "film" | "lesson",
  language: string,
  c: VideoComprehension,
): Promise<{ first: number; latest: number; isFirst: boolean }> {
  const existing = await loadComprehensionRecord(userId, contentId, contentType);
  const nowIso = new Date().toISOString();
  if (!existing) {
    await supabase.from("video_comprehension" as any).insert({
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      language,
      first_score: c.pct,
      latest_score: c.pct,
      green_count: c.greenCount,
      orange_count: c.orangeCount,
      red_count: c.redCount,
      total_tokens: c.totalTokens,
      first_watched_at: nowIso,
      last_watched_at: nowIso,
    } as any);
    return { first: c.pct, latest: c.pct, isFirst: true };
  }
  await supabase
    .from("video_comprehension" as any)
    .update({
      latest_score: c.pct,
      green_count: c.greenCount,
      orange_count: c.orangeCount,
      red_count: c.redCount,
      total_tokens: c.totalTokens,
      last_watched_at: nowIso,
    } as any)
    .eq("id", existing.id);
  return { first: existing.first_score, latest: c.pct, isFirst: false };
}

/** Rows for the "Your Progress" dashboard, sorted by largest improvement. */
export interface ProgressRow extends ComprehensionRecord {
  title: string | null;
  thumbnail_url: string | null;
  delta: number;
}
export async function listYourProgress(userId: string): Promise<ProgressRow[]> {
  const { data } = await supabase
    .from("video_comprehension" as any)
    .select("*")
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false })
    .limit(50);
  const rows = (data as any[]) || [];
  if (rows.length === 0) return [];
  const filmIds = Array.from(new Set(rows.filter((r) => r.content_type === "film").map((r) => r.content_id)));
  const filmMap = new Map<string, { title: string | null; thumbnail_url: string | null }>();
  if (filmIds.length) {
    const { data: films } = await supabase
      .from("films")
      .select("id, title, thumbnail_url")
      .in("id", filmIds);
    for (const f of (films as any[]) || []) {
      filmMap.set(f.id, { title: f.title, thumbnail_url: f.thumbnail_url });
    }
  }
  return rows
    .map((r) => {
      const meta = filmMap.get(r.content_id) || { title: null, thumbnail_url: null };
      return {
        ...(r as ComprehensionRecord),
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
        delta: Number(r.latest_score) - Number(r.first_score),
      };
    })
    .sort((a, b) => b.delta - a.delta);
}

export function zoneMessage(pct: number): string {
  if (pct >= 96) return "You already understand this video. Push yourself with something harder.";
  if (pct >= 85) return "Right in your ideal zone — comfortable enough to enjoy, challenging enough to learn.";
  if (pct >= 70) return "A stretch video. You'll meet new words — perfect for active learning.";
  if (pct >= 40) return "This is above your current level, but you'll pick up high-value vocabulary fast.";
  return "Very challenging right now. Save some words and come back — you'll understand more next time.";
}
