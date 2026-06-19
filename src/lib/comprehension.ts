// LinguaScript Comprehension Engine — deterministic, no AI.
// Maps every transcript word to Red/Orange/Green using saved_words state only.

import { supabase } from "@/integrations/supabase/client";
import { loadDeckIndex, normalizeToken, type DeckState } from "@/lib/vocab";

export type WordState = DeckState | "unknown"; // unknown = not in user vocab → treated as red

export interface TokenizedTranscript {
  /** lowercased, punctuation-stripped, non-empty tokens */
  words: string[];
  /** unique normalized tokens */
  uniqueWords: string[];
  /** frequency of each unique token */
  frequency: Record<string, number>;
  /** sentence-level blocks (joined transcript text split by ., ?, !) */
  sentences: string[];
}

const WEIGHT: Record<WordState, number> = {
  green: 1.0,
  orange: 0.5,
  red: 0.0,
  unknown: 0.0,
};

/** Split joined transcript text into normalized tokens + sentences. */
export function tokenizeTranscript(rawText: string): TokenizedTranscript {
  const cleaned = rawText.replace(/\s+/g, " ").trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const words: string[] = [];
  const freq: Record<string, number> = {};
  for (const raw of cleaned.split(/\s+/)) {
    const t = normalizeToken(raw);
    if (!t || /^\d+$/.test(t)) continue;
    words.push(t);
    freq[t] = (freq[t] || 0) + 1;
  }
  return {
    words,
    uniqueWords: Object.keys(freq),
    frequency: freq,
    sentences,
  };
}

export interface WordBreakdown {
  word: string;
  state: WordState;
  count: number;
}

export interface ComprehensionResult {
  score: number; // 0–100
  totalWords: number;
  uniqueWords: number;
  green: WordBreakdown[];
  orange: WordBreakdown[];
  red: WordBreakdown[]; // includes "unknown" — every non-vocab word
  counts: { green: number; orange: number; red: number };
  /** Per-token (running) weighted total — useful for ladder math. */
  totalWeight: number;
}

/** Map every transcript token against user vocab and compute the weighted % score. */
export function computeComprehension(
  transcript: TokenizedTranscript,
  vocab: Map<string, { state: DeckState }>,
): ComprehensionResult {
  const stateByWord: Record<string, WordState> = {};
  for (const w of transcript.uniqueWords) {
    const hit = vocab.get(w);
    stateByWord[w] = hit ? hit.state : "unknown";
  }

  let totalWeight = 0;
  const counts = { green: 0, orange: 0, red: 0 };
  for (const w of transcript.words) {
    const st = stateByWord[w];
    totalWeight += WEIGHT[st];
    if (st === "green") counts.green++;
    else if (st === "orange") counts.orange++;
    else counts.red++; // red + unknown both count as red
  }

  const total = transcript.words.length;
  const score = total === 0 ? 0 : (totalWeight / total) * 100;

  const groups: Record<"green" | "orange" | "red", WordBreakdown[]> = {
    green: [],
    orange: [],
    red: [],
  };
  for (const word of transcript.uniqueWords) {
    const st = stateByWord[word];
    const bucket = st === "green" ? "green" : st === "orange" ? "orange" : "red";
    groups[bucket].push({ word, state: st, count: transcript.frequency[word] });
  }
  // Sort each bucket by frequency desc — most-impactful words first.
  for (const k of ["green", "orange", "red"] as const) {
    groups[k].sort((a, b) => b.count - a.count);
  }

  return {
    score: Math.round(score * 10) / 10,
    totalWords: total,
    uniqueWords: transcript.uniqueWords.length,
    green: groups.green,
    orange: groups.orange,
    red: groups.red,
    counts,
    totalWeight,
  };
}

/**
 * "+N Green words needed to reach X%."
 * Greedy: promote the highest-frequency RED words to GREEN until the score crosses the target.
 * Returns the ordered list of words to learn.
 */
export function wordsNeededForTarget(
  result: ComprehensionResult,
  targetPercent: number,
): { wordsNeeded: number; words: WordBreakdown[]; reachable: boolean } {
  if (result.totalWords === 0) return { wordsNeeded: 0, words: [], reachable: false };
  if (result.score >= targetPercent) return { wordsNeeded: 0, words: [], reachable: true };

  // Each RED word currently contributes 0; promoting to GREEN adds (count * 1.0) to totalWeight.
  // Promoting ORANGE to GREEN adds (count * 0.5).
  // We only count RED→GREEN here (spec: "+N Green words needed").
  const sorted = [...result.red].sort((a, b) => b.count - a.count);
  let weight = result.totalWeight;
  const picked: WordBreakdown[] = [];
  const targetWeight = (targetPercent / 100) * result.totalWords;
  for (const w of sorted) {
    if (weight >= targetWeight) break;
    weight += w.count; // promoting red → green adds full count
    picked.push(w);
  }
  return {
    wordsNeeded: picked.length,
    words: picked,
    reachable: weight >= targetWeight,
  };
}

export const COMPREHENSION_LADDER = [
  { target: 50, label: "Basic understanding" },
  { target: 70, label: "Comfortable watching" },
  { target: 80, label: "Strong comprehension" },
] as const;

/** Load saved vocab for a language using the existing deck index. */
export async function loadUserVocab(userId: string | null, language: string) {
  return loadDeckIndex(userId, language);
}

/** Persist a comprehension snapshot — silent no-op for guest users. */
export async function saveSnapshot(params: {
  userId: string | null;
  videoId: string;
  language: string;
  title?: string;
  result: ComprehensionResult;
}) {
  if (!params.userId) return;
  const { error } = await supabase.from("comprehension_snapshots").insert({
    user_id: params.userId,
    video_id: params.videoId,
    language: params.language,
    title: params.title ?? null,
    score: params.result.score,
    green_count: params.result.counts.green,
    orange_count: params.result.counts.orange,
    red_count: params.result.counts.red,
    total_words: params.result.totalWords,
    unique_words: params.result.uniqueWords,
  });
  if (error) console.warn("[comprehension] saveSnapshot failed", error);
}

export interface ProgressionDelta {
  previousScore: number | null;
  currentScore: number;
  deltaThisWeek: number | null; // current - best score from >7d ago
  lastSeenAt: string | null;
}

/** Compare current score against the user's last snapshot for this video. */
export async function loadProgression(
  userId: string,
  videoId: string,
  currentScore: number,
): Promise<ProgressionDelta> {
  const { data } = await supabase
    .from("comprehension_snapshots")
    .select("score, created_at")
    .eq("user_id", userId)
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0];
  return {
    previousScore: last ? Number(last.score) : null,
    currentScore,
    deltaThisWeek: last ? Math.round((currentScore - Number(last.score)) * 10) / 10 : null,
    lastSeenAt: last?.created_at ?? null,
  };
}
