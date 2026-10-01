/**
 * "You know 47 of the 50 most common French words."
 *
 * Reads the `frequency_coverage` RPC. `known` counts only words the learner
 * actually learned; `assumed` counts words seeded from their starting level.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CoverageBand {
  band: number;
  known: number;
  total: number;
  assumed: number;
}

export async function loadFrequencyCoverage(language: string): Promise<CoverageBand[]> {
  const { data, error } = await supabase.rpc("frequency_coverage" as any, {
    _language: language,
  });
  if (error) {
    console.warn("[frequencyCoverage]", error);
    return [];
  }
  return ((data as any[]) || []).map((r) => ({
    band: Number(r.band ?? 0),
    known: Number(r.known ?? r.known_words ?? 0),
    total: Number(r.total ?? r.total_words ?? 0),
    assumed: Number(r.assumed_words ?? 0),
  }));
}

/** Smallest band not yet finished; the largest once everything is known. */
export function headlineBand(bands: CoverageBand[]): CoverageBand | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.band - b.band);
  return sorted.find((b) => b.known < b.total) ?? sorted[sorted.length - 1];
}

/**
 * Deck unlocking: the first band not yet fully known, where words assumed
 * from the learner's starting level count as known (they already know them).
 */
export function unlockedBand(bands: CoverageBand[]): number {
  const sorted = [...bands].sort((a, b) => a.band - b.band);
  return (sorted.find((b) => b.known + b.assumed < b.total) ?? sorted[sorted.length - 1])?.band ?? 50;
}
