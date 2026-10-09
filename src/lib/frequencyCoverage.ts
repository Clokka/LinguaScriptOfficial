/**
 * "You know 47 of the 50 most common French words."
 *
 * Reads the `frequency_coverage` RPC. `known` counts only words the learner
 * actually learned; `assumed` counts words seeded from their starting level;
 * `reviewing` counts words already learned once but currently in review
 * (orange) — they never block a deck from unlocking.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CoverageBand {
  band: number;
  known: number;
  total: number;
  assumed: number;
  reviewing: number;
}

export async function loadFrequencyCoverage(language: string): Promise<CoverageBand[]> {
  const [{ data, error }, rev] = await Promise.all([
    supabase.rpc("frequency_coverage" as any, { _language: language }),
    supabase.rpc("frequency_reviewing" as any, { _language: language }),
  ]);
  if (error) {
    console.warn("[frequencyCoverage]", error);
    return [];
  }
  const revMap = new Map<number, number>();
  for (const r of ((rev.data as any[]) || [])) revMap.set(Number(r.band), Number(r.reviewing_words ?? 0));
  return ((data as any[]) || []).map((r) => {
    const band = Number(r.band ?? 0);
    return {
      band,
      known: Number(r.known ?? r.known_words ?? 0),
      total: Number(r.total ?? r.total_words ?? 0),
      assumed: Number(r.assumed_words ?? 0),
      reviewing: revMap.get(band) ?? 0,
    };
  });
}

/** Words that count toward finishing a deck: known, assumed, or in review. */
export function doneCount(b: CoverageBand | undefined): number {
  if (!b) return 0;
  return Math.min(b.total, b.known + b.assumed + b.reviewing);
}

/** Smallest band not yet finished; the largest once everything is known. */
export function headlineBand(bands: CoverageBand[]): CoverageBand | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.band - b.band);
  const target = sorted.find((b) => doneCount(b) < b.total) ?? sorted[sorted.length - 1];
  return { ...target, known: Math.min(target.total, target.known + target.assumed), assumed: 0 };
}

/**
 * Deck unlocking: the first band not yet finished. Words assumed from the
 * starting level, and words currently being reviewed, count as finished.
 */
export function unlockedBand(bands: CoverageBand[]): number {
  const sorted = [...bands].sort((a, b) => a.band - b.band);
  return (sorted.find((b) => doneCount(b) < b.total) ?? sorted[sorted.length - 1])?.band ?? 50;
}
