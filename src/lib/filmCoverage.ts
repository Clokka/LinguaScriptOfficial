// "41% of Spanish film & TV words are yours" for the website home (/home).
// Same rule as the extension's Vocabulary growth card (extension/background.js
// getProgress): a word's share = its count in OpenSubtitles 2018 / every word
// in the corpus (src/data/wordlists/<lang>.json, CC BY-SA 4.0). Known = green
// or gold; decks = any colour. Never typed numbers.
import { normalizeToken } from "@/lib/vocab";

const FILES: Record<string, string> = { fr: "fr", es: "es", de: "de", it: "it", pt: "pt_br", en: "en" };
const lists = import.meta.glob("../data/wordlists/*.json", { import: "default" });

export interface CoverageRow { word: string; state: string; created_at?: string | null; state_changed_at?: string | null; gold?: boolean }
export interface FilmCoverage { known: number; decks: number; weekGain: number }

const cache = new Map<string, Promise<Map<string, number> | null>>();
export function loadShares(lang: string): Promise<Map<string, number> | null> {
  const file = FILES[lang];
  const load = file && lists[`../data/wordlists/${file}.json`];
  if (!load) return Promise.resolve(null);
  if (!cache.has(file)) {
    cache.set(file, (load() as Promise<{ coverage: Record<string, number>; words: { w: string; c: number }[] }>).then((d) => {
      const top = d.words.reduce((a, x) => a + x.c, 0);
      const total = top / (d.coverage["3000"] / 100); // the lists keep 3,000 words; coverage is of the whole corpus
      const m = new Map<string, number>();
      for (const x of d.words) {
        const k = normalizeToken(x.w);
        if (k) m.set(k, (m.get(k) || 0) + (x.c / total) * 100);
      }
      return m;
    }).catch(() => null));
  }
  return cache.get(file)!;
}

/** Known % now, decks % now, and how much the known % (or decks %, for a brand-new learner) grew in 7 days. */
export function filmCoverage(shares: Map<string, number>, rows: CoverageRow[]): FilmCoverage {
  const weekAgo = Date.now() - 7 * 86400000;
  const seen = new Set<string>();
  let known = 0, decks = 0, knownWeek = 0, decksWeek = 0;
  for (const r of rows) {
    const k = normalizeToken(r.word);
    const share = shares.get(k);
    if (!share || seen.has(k)) continue;
    seen.add(k);
    decks += share;
    if (Date.parse(r.created_at || "") > weekAgo) decksWeek += share;
    if (r.state === "green" || r.gold) {
      known += share;
      if (Date.parse(r.state_changed_at || r.created_at || "") > weekAgo) knownWeek += share;
    }
  }
  return { known: Math.min(100, known), decks: Math.min(100, decks), weekGain: known >= 1 ? knownWeek : decksWeek };
}
