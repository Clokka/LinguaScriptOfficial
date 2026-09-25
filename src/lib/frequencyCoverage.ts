/**
 * "You know 412 of the 1,000 most common French words."
 *
 * Reads the `frequency_coverage` RPC, which counts the learner's green words
 * against `core_vocabulary` ranks at fixed bands.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CoverageBand {
  band: number;
  known: number;
  total: number;
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
    band: Number(r.band ?? r.rank_band ?? 0),
    known: Number(r.known ?? r.known_words ?? 0),
    total: Number(r.total ?? r.total_words ?? 0),
  }));
}

/**
 * The band worth showing: the smallest one the learner hasn't finished yet,
 * which is the only honest "next milestone" — falls back to the largest band
 * once every word is known.
 */
export function headlineBand(bands: CoverageBand[]): CoverageBand | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.band - b.band);
  return sorted.find((b) => b.known < b.total) ?? sorted[sorted.length - 1];
}
