// Batch estimator for "Estimated Understanding %" badges on content cards.
// Loads the user's deck once, fetches subtitles for a set of film ids in a
// single query, and scores each film with the same weighted model used by
// `videoComprehension.ts`.
import { supabase } from "@/integrations/supabase/client";
import { tokenize, tokenWeight } from "@/lib/understanding";
import { loadDeckIndex, normalizeToken, type SavedWordLite } from "@/lib/vocab";

export type EstimateBand = "perfect" | "comfortable" | "stretch" | "later";

export interface FilmEstimate {
  filmId: string;
  pct: number | null; // null = no transcript available
  band: EstimateBand | null;
}

export function bandFor(pct: number): EstimateBand {
  if (pct >= 85) return "comfortable";
  if (pct >= 70) return "perfect";
  if (pct >= 40) return "stretch";
  return "later";
}

export function bandLabel(band: EstimateBand): string {
  switch (band) {
    case "comfortable": return "Comfortable";
    case "perfect":     return "Perfect Match";
    case "stretch":     return "Stretch";
    case "later":       return "Recommended Later";
  }
}

export function bandClasses(band: EstimateBand): string {
  switch (band) {
    case "comfortable": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "perfect":     return "bg-primary/15 text-primary border-primary/30";
    case "stretch":     return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "later":       return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  }
}

function scoreTokens(tokens: string[], language: string, deck: Map<string, SavedWordLite>): number {
  if (tokens.length === 0) return 0;
  let totalW = 0;
  let knownW = 0;
  for (const t of tokens) {
    const w = tokenWeight(t, language);
    totalW += w;
    const st = deck.get(normalizeToken(t))?.state;
    if (st === "green") knownW += w;
    else if (st === "orange") knownW += w * 0.5;
  }
  return totalW > 0 ? Math.round((knownW / totalW) * 100) : 0;
}

/**
 * Estimate understanding % for many films at once.
 * Returns a map keyed by film id. Films without subtitles get pct=null.
 */
export async function estimateFilms(
  userId: string | null,
  filmIds: string[],
  language: string,
): Promise<Map<string, FilmEstimate>> {
  const out = new Map<string, FilmEstimate>();
  if (filmIds.length === 0) return out;
  for (const id of filmIds) out.set(id, { filmId: id, pct: null, band: null });

  const [{ data: subs }, deck] = await Promise.all([
    supabase
      .from("subtitles")
      .select("film_id, text")
      .in("film_id", filmIds)
      .eq("language", language),
    loadDeckIndex(userId, language),
  ]);

  const tokensByFilm = new Map<string, string[]>();
  for (const row of (subs as any[]) || []) {
    const arr = tokensByFilm.get(row.film_id) || [];
    for (const tok of tokenize(row.text || "")) arr.push(tok);
    tokensByFilm.set(row.film_id, arr);
  }
  for (const id of filmIds) {
    const tokens = tokensByFilm.get(id);
    if (!tokens || tokens.length === 0) continue;
    const pct = scoreTokens(tokens, language, deck);
    out.set(id, { filmId: id, pct, band: bandFor(pct) });
  }
  return out;
}
