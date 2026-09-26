import { supabase } from "@/integrations/supabase/client";

export interface PreTeachItem {
  item: string;
  translation: string;
  example: string;
  exampleTranslation: string;
  cefr: string | null;
  rank: number;
  occurrences: number;
  isPhrase: boolean;
}

interface Line { primary: string; secondary: string }

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
// Frequency ceiling per learner level — keeps out "cucumber / helicopter" words.
const RANK_CAP: Record<string, number> = { a1: 1500, a2: 2500, b1: 4500, b2: 7000, c1: 12000, c2: 20000 };

function tokenize(text: string, lang: string): string[] {
  const seg = (Intl as any).Segmenter;
  if (seg) {
    try {
      const s = new seg(lang, { granularity: "word" });
      return Array.from(s.segment(text) as Iterable<any>)
        .filter((x: any) => x.isWordLike)
        .map((x: any) => String(x.segment).toLowerCase());
    } catch { /* fall through */ }
  }
  return text.toLowerCase().split(/[^\p{L}\p{M}']+/u).filter(Boolean);
}

/**
 * Pre-teach grader (Vocab-Kitchen style): scans the transcript, grades every
 * word/phrase against the 20k frequency + CEFR list, and returns the N most
 * useful items at or just above the learner's level. Phrases/collocations
 * first, then high-frequency words that recur in this video.
 */
export async function gradePreTeachVocab(opts: {
  lines: Line[];
  language: string;
  level: string | null;
  count: number;
  userId?: string | null;
}): Promise<PreTeachItem[]> {
  const { lines, language, count } = opts;
  const lang = language.toLowerCase();
  const level = (opts.level || "a2").toLowerCase().slice(0, 2);
  const li = Math.max(0, LEVELS.indexOf(level));
  const allowed = new Set([LEVELS[li], LEVELS[Math.min(li + 1, 5)], ...(li <= 1 ? ["a1"] : [])]);
  const cap = RANK_CAP[LEVELS[Math.min(li + 1, 5)]] ?? 4500;
  const spaced = !["zh", "ja", "th"].includes(lang);

  // Count unigrams + (for spaced languages) bigrams/trigrams, remembering a sample line.
  const counts = new Map<string, { n: number; line: Line }>();
  const bump = (k: string, line: Line) => {
    const c = counts.get(k);
    if (c) c.n++; else counts.set(k, { n: 1, line });
  };
  for (const line of lines) {
    const toks = tokenize(line.primary, lang);
    toks.forEach((t, i) => {
      bump(t, line);
      if (spaced && i + 1 < toks.length) bump(`${t} ${toks[i + 1]}`, line);
      if (spaced && i + 2 < toks.length) bump(`${t} ${toks[i + 1]} ${toks[i + 2]}`, line);
    });
  }
  const keys = Array.from(counts.keys()).filter((k) => k.length > 1 || !spaced);
  if (!keys.length) return [];

  // Look up in the core frequency list, in chunks.
  const vocab: any[] = [];
  for (let i = 0; i < keys.length; i += 300) {
    const chunk = keys.slice(i, i + 300);
    const { data } = await supabase
      .from("core_vocabulary")
      .select("word, lemma, translation, rank, cefr_level")
      .eq("language", lang)
      .lte("rank", cap)
      .in("word", chunk);
    if (data) vocab.push(...data);
  }

  // Drop words the learner already knows (green).
  let known = new Set<string>();
  if (opts.userId) {
    const { data } = await supabase
      .from("saved_words")
      .select("word, lemma")
      .eq("user_id", opts.userId)
      .eq("language", lang)
      .eq("state", "green")
      .limit(5000);
    known = new Set((data || []).flatMap((w: any) => [w.word?.toLowerCase(), w.lemma?.toLowerCase()]).filter(Boolean));
  }

  const seenLemma = new Set<string>();
  const scored: (PreTeachItem & { score: number })[] = [];
  for (const v of vocab) {
    const w = String(v.word).toLowerCase();
    const lemma = String(v.lemma || w).toLowerCase();
    const cefr = v.cefr_level ? String(v.cefr_level).toLowerCase() : null;
    if (known.has(w) || known.has(lemma)) continue;
    if (cefr && !allowed.has(cefr)) continue;
    const c = counts.get(w);
    if (!c) continue;
    const isPhrase = w.includes(" ");
    // Very short function words (le, de, 的) aren't worth pre-teaching alone.
    if (!isPhrase && spaced && w.length < 3) continue;
    if (!isPhrase && v.rank <= 40) continue;
    const score = c.n * (1 / Math.log(v.rank + 10)) * (isPhrase ? 3 : 1) * (c.n >= 2 ? 1.5 : 1);
    scored.push({
      item: v.word, translation: v.translation, example: c.line.primary, exampleTranslation: c.line.secondary,
      cefr, rank: v.rank, occurrences: c.n, isPhrase, score,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const out: PreTeachItem[] = [];
  for (const s of scored) {
    const key = s.item.toLowerCase();
    if (seenLemma.has(key)) continue;
    seenLemma.add(key);
    out.push(s);
    if (out.length >= count) break;
  }
  return out;
}
