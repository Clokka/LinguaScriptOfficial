/**
 * Phrase finder — an AntConc-style concordancer core for LinguaScript.
 *
 * AntConc (Laurence Anthony) is a desktop app, so it can't be embedded. This
 * module reimplements the three AntConc views the chunk curriculum needs, so
 * they can run over LinguaScript's own transcripts (scripts/phrases/antconc.ts)
 * and, later, per video inside the app:
 *
 *   N-Grams     every 2–5 word sequence, with frequency and RANGE (how many
 *               different videos/texts it appears in — a phrase used by one
 *               character in one film is not a chunk worth teaching).
 *   Collocates  mutual information (MI): do these words occur together more
 *               than chance? "il y a" scores high; "et le" is just two common
 *               words next to each other and scores low.
 *   P-frames    phrase-frames (Römer 2010): an n-gram with one open slot,
 *               e.g. "j' ai besoin de *". A frame filled by many different
 *               words is a productive sentence structure — exactly what the
 *               Sentence Lab (Block Blast) board is built from.
 *
 * Pure functions, no dependencies, so the same code runs in Node scripts, the
 * browser and Deno edge functions.
 */

/** The open slot in a phrase-frame. */
export const SLOT = "*";

/**
 * Split text into word tokens the way the reference n-gram lists do (Google
 * Books n-grams split elisions off: "j'ai" → "j'", "ai"). Lowercases, keeps
 * accents, drops punctuation and bracketed sound cues like "[rires]".
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/\[[^\]]*\]|\([^)]*\)|<[^>]*>/g, " ")
    // Elision: keep the apostrophe on the first part ("j'", "qu'", "aujourd'hui" stays whole).
    .replace(/\b(j|l|d|m|t|s|n|c|qu|jusqu|lorsqu|puisqu|quoiqu)'(?=\p{L})/gu, "$1' ")
    // Hyphens join inverted pronouns ("est-ce", "peux-tu") — treat as separate words.
    .replace(/-(?=\p{L})/gu, " ")
    .split(/[^\p{L}\p{N}']+/u)
    .map((t) => t.replace(/^'+/, ""))
    .filter((t) => t.length > 0 && /\p{L}/u.test(t));
}

export interface NgramStat {
  gram: string;
  n: number;
  freq: number;
  /** Number of different documents (videos/texts) it appears in. */
  range: number;
  /** Mutual information in bits; null when a component word count is unknown. */
  mi: number | null;
}

export interface CountOptions {
  minN?: number;
  maxN?: number;
  minFreq?: number;
  minRange?: number;
}

/**
 * Count n-grams across documents (AntConc's N-Gram view with range).
 * Each document is one video / text, already tokenized. N-grams never cross
 * a line break, so pass one array per subtitle line inside `lines` if you
 * have them — otherwise a whole document is one run of text.
 */
export function countNgrams(
  documents: string[][][],
  { minN = 2, maxN = 5, minFreq = 3, minRange = 2 }: CountOptions = {},
): NgramStat[] {
  const freq = new Map<string, number>();
  const docsWith = new Map<string, number>();
  const wordFreq = new Map<string, number>();
  let totalWords = 0;

  for (const doc of documents) {
    const seenInDoc = new Set<string>();
    for (const line of doc) {
      for (const w of line) {
        wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
        totalWords++;
      }
      for (let n = minN; n <= maxN; n++) {
        for (let i = 0; i + n <= line.length; i++) {
          const gram = line.slice(i, i + n).join(" ");
          freq.set(gram, (freq.get(gram) ?? 0) + 1);
          if (!seenInDoc.has(gram)) {
            seenInDoc.add(gram);
            docsWith.set(gram, (docsWith.get(gram) ?? 0) + 1);
          }
        }
      }
    }
  }

  const out: NgramStat[] = [];
  for (const [gram, f] of freq) {
    const range = docsWith.get(gram) ?? 0;
    if (f < minFreq || range < minRange) continue;
    const words = gram.split(" ");
    out.push({ gram, n: words.length, freq: f, range, mi: mutualInformation(f, words, wordFreq, totalWords) });
  }
  return out.sort((a, b) => b.freq - a.freq);
}

/**
 * Multi-word mutual information: log2( P(w1..wn) / Π P(wi) ).
 * High = the words belong together; ~0 = they just happen to be common.
 */
export function mutualInformation(
  gramFreq: number,
  words: string[],
  wordFreq: Map<string, number>,
  totalWords: number,
): number | null {
  if (totalWords <= 0) return null;
  let logExpected = 0;
  for (const w of words) {
    const f = wordFreq.get(w);
    if (!f) return null;
    logExpected += Math.log2(f / totalWords);
  }
  return Math.log2(gramFreq / totalWords) - logExpected;
}

export interface PhraseFrame {
  /** e.g. "j' ai besoin de *" */
  frame: string;
  n: number;
  /** Total frequency of every n-gram matching the frame. */
  freq: number;
  /** Distinct words seen in the slot — the frame's productivity. */
  variants: number;
  /** variants / freq: near 1 = open slot, near 0 = one filler dominates. */
  typeTokenRatio: number;
  /** Most common fillers, best first. */
  topFillers: { word: string; freq: number }[];
}

export interface FrameOptions {
  minN?: number;
  maxN?: number;
  /** A frame needs at least this many different fillers to be productive. */
  minVariants?: number;
  minFreq?: number;
  /** Where the slot may go. Römer's p-frames allow any position. */
  slotPositions?: "any" | "internal-or-final";
  topFillerCount?: number;
}

/**
 * Build phrase-frames from counted n-grams (AntConc-style "P-Frames" view).
 * Accepts raw corpus counts or a pre-counted list such as Google Books n-grams.
 */
export function extractFrames(
  ngrams: { gram: string; freq: number }[],
  {
    minN = 3,
    maxN = 5,
    minVariants = 3,
    minFreq = 1,
    slotPositions = "internal-or-final",
    topFillerCount = 8,
  }: FrameOptions = {},
): PhraseFrame[] {
  const frames = new Map<string, { n: number; freq: number; fillers: Map<string, number> }>();

  for (const { gram, freq } of ngrams) {
    const words = gram.split(" ");
    const n = words.length;
    if (n < minN || n > maxN) continue;
    for (let i = 0; i < n; i++) {
      // A frame that starts with its slot ("* de plus en plus") is rarely a
      // teachable starter; keep it only when asked for every position.
      if (slotPositions === "internal-or-final" && i === 0) continue;
      const key = [...words.slice(0, i), SLOT, ...words.slice(i + 1)].join(" ");
      let entry = frames.get(key);
      if (!entry) {
        entry = { n, freq: 0, fillers: new Map() };
        frames.set(key, entry);
      }
      entry.freq += freq;
      entry.fillers.set(words[i], (entry.fillers.get(words[i]) ?? 0) + freq);
    }
  }

  const out: PhraseFrame[] = [];
  for (const [frame, { n, freq, fillers }] of frames) {
    if (fillers.size < minVariants || freq < minFreq) continue;
    const topFillers = [...fillers.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topFillerCount)
      .map(([word, f]) => ({ word, freq: f }));
    out.push({ frame, n, freq, variants: fillers.size, typeTokenRatio: fillers.size / freq, topFillers });
  }
  return out.sort((a, b) => b.freq - a.freq);
}

/**
 * Map every token of a phrase to its dictionary form, so "j' avais besoin de"
 * and "j' ai besoin de" share one key ("je avoir besoin de"). Unknown words
 * pass through unchanged.
 */
export function lemmaKey(gram: string, lemmaOf: (word: string) => string | undefined): string {
  return gram
    .split(" ")
    .map((w) => (w === SLOT ? w : lemmaOf(w) ?? w))
    .join(" ");
}
