/**
 * Teaching helpers for LinguaScripts sessions: fair distractors, sentence
 * quality checks, multi-word units and spaced scheduling.
 */
import { supabase } from "@/integrations/supabase/client";

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const PUNCT = /[.,!?;:«»"'¿¡…()“”]/g;
export const cleanToken = (w: string) => w.toLowerCase().replace(PUNCT, "");

/* ---------- Multi-word units ---------- */

/** Contiguous chunks taught as one item. Discontinuous pairs are in PAIRS. */
const UNITS: Record<string, string[]> = {
  fr: ["il y a", "est-ce que", "parce que", "tout le monde", "en train de", "tout à fait", "d'accord", "peut-être", "c'est-à-dire", "quelque chose", "tout de suite"],
  es: ["hay que", "a veces", "por favor", "sin embargo", "tener que", "de nuevo", "por eso", "todo el mundo"],
  it: ["c'è", "ci sono", "per favore", "di nuovo", "tutti i giorni", "va bene", "perché no"],
  de: ["es gibt", "zum Beispiel", "auf jeden Fall", "gar nicht", "noch nicht", "ein bisschen"],
  pt: ["há que", "por favor", "de novo", "todo mundo", "tem que", "às vezes"],
};

/** Words that only mean something as part of a split pair. */
const PAIRS: Record<string, Record<string, string>> = {
  fr: { ne: "ne … pas", pas: "ne … pas", jamais: "ne … jamais", rien: "ne … rien", plus: "ne … plus" },
  es: { ni: "ni … ni" },
  de: { weder: "weder … noch", noch: "weder … noch" },
};

export function pairHint(word: string, language: string): string | null {
  return PAIRS[language]?.[cleanToken(word)] ?? null;
}

/**
 * Find the unit containing the target in the sentence, merge its tokens into
 * one so it is gapped/checked as a single item. Returns tokens + gap index.
 */
export function tokensWithUnit(sentence: string, target: string, language: string) {
  let tokens = sentence.split(/\s+/).filter(Boolean);
  const t = cleanToken(target);
  for (const unit of UNITS[language] || []) {
    const parts = unit.toLowerCase().split(" ");
    if (parts.length < 2 || !parts.some((p) => cleanToken(p) === t) && cleanToken(unit) !== t) continue;
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      const slice = tokens.slice(i, i + parts.length).map(cleanToken);
      if (slice.join(" ") === parts.map(cleanToken).join(" ")) {
        const merged = tokens.slice(i, i + parts.length).join(" ");
        tokens = [...tokens.slice(0, i), merged, ...tokens.slice(i + parts.length)];
        return { tokens, gapIndex: i, unit: merged.replace(PUNCT, "") };
      }
    }
  }
  let gi = tokens.findIndex((w) => cleanToken(w) === t);
  if (gi === -1) gi = tokens.findIndex((w) => cleanToken(w).includes(t));
  return { tokens, gapIndex: Math.max(0, gi), unit: null as string | null };
}

/* ---------- Sentence quality ---------- */

/**
 * A usable teaching sentence: 4–14 words, contains the word, no mid-sentence
 * capitalised names (subtitle scraps like "mademoiselle Bertignac").
 */
export function isCleanSentence(sentence: string, word: string, language: string): boolean {
  if (!sentence) return false;
  const toks = sentence.trim().split(/\s+/);
  if (toks.length < 4 || toks.length > 14) return false;
  const w = cleanToken(word);
  if (!toks.some((x) => cleanToken(x) === w || cleanToken(x).includes(w))) return false;
  // German capitalises nouns; scripts without case are unaffected.
  if (language !== "de") {
    for (let i = 1; i < toks.length; i++) {
      const prev = toks[i - 1];
      if (/[.!?]$/.test(prev)) continue;
      const tok = toks[i].replace(PUNCT, "");
      if (/^\p{Lu}\p{Ll}/u.test(tok) && tok !== "I") return false;
    }
  }
  if (/[-–—]$/.test(sentence.trim()) || /\.\.\.$/.test(sentence.trim())) return false;
  return true;
}

/* ---------- Distractors from core vocabulary ---------- */

export interface VocabRow {
  word: string;
  translation: string;
  pos: string | null;
  rank: number;
}

/** Load a band of common words for this language, for fair distractors. */
export async function loadVocabBand(language: string, maxRank: number): Promise<VocabRow[]> {
  const { data } = await supabase
    .from("core_vocabulary")
    .select("word, translation, pos, rank")
    .eq("language", language)
    .lte("rank", Math.max(400, maxRank + 400))
    .order("rank", { ascending: true })
    .limit(2000);
  return ((data || []) as any[]).filter((r) => r.word && r.translation) as VocabRow[];
}

function candidatesFor(target: string, band: VocabRow[]) {
  const t = cleanToken(target);
  const me = band.find((r) => cleanToken(r.word) === t);
  const rank = me?.rank ?? 500;
  const samePos = band.filter(
    (r) => cleanToken(r.word) !== t && (!me?.pos || r.pos === me.pos) && Math.abs(r.rank - rank) <= 300,
  );
  const pool = samePos.length >= 6 ? samePos : band.filter((r) => cleanToken(r.word) !== t);
  return { me, pool: shuffle(pool) };
}

/** 3 distinct wrong words of the same type and frequency, for a gap. */
export function gapDistractors(target: string, band: VocabRow[], fallback: string[]): string[] {
  const t = cleanToken(target);
  const seen = new Set([t]);
  const out: string[] = [];
  const { pool } = candidatesFor(target, band);
  for (const w of [...pool.map((r) => r.word), ...shuffle(fallback)]) {
    const c = cleanToken(w);
    if (!c || c.length < 2 || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

/** 3 distinct wrong meanings with the word each belongs to (for feedback). */
export function meaningDistractors(
  target: string,
  meaning: string,
  band: VocabRow[],
  fallback: string[],
): { meaning: string; word?: string }[] {
  const seen = new Set([meaning.toLowerCase().trim()]);
  const out: { meaning: string; word?: string }[] = [];
  const { pool } = candidatesFor(target, band);
  const src = [
    ...pool.map((r) => ({ meaning: r.translation, word: r.word })),
    ...shuffle(fallback).map((m) => ({ meaning: m })),
  ];
  for (const c of src) {
    const k = c.meaning.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

/* ---------- Scheduling ---------- */

export const INTERVALS = [1, 3, 7, 21, 60];

export type RecallResult = "clean" | "assisted" | "failed";

/**
 * Next interval step from the whole word's performance this session.
 * Clean everywhere climbs; any slip holds; failed recall resets.
 */
export function nextStage(cur: number, recall: RecallResult, slipped: boolean): number {
  if (recall === "failed") return 0;
  if (recall === "clean" && !slipped) return Math.min(cur + 1, INTERVALS.length - 1);
  return Math.min(cur, INTERVALS.length - 1);
}

/** Due date with ±10% jitter on longer gaps so reviews don't all stack. */
export function dueDate(stage: number): Date {
  const days = INTERVALS[stage];
  const jitter = days >= 3 ? days * (Math.random() * 0.2 - 0.1) : 0;
  return new Date(Date.now() + (days + jitter) * 86400000);
}

/** True when the timestamp is from an earlier calendar day than today. */
export function beforeToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return new Date(iso) < start;
}
