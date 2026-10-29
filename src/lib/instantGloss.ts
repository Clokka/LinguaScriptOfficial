/**
 * Instant translations for common words.
 *
 * `vocab_translations` holds a curated dictionary of the ~5,000 most common
 * words per language (see supabase/seed/vocab_translations). The whole list
 * for one language pair is loaded once per session (about 5,000 short rows),
 * so tapping a common word shows its meaning immediately instead of waiting
 * on the AI — which is slow, and unreliable for tiny words like "que".
 *
 * Rare words still go through the translate-word edge function as before.
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizeToken } from "@/lib/vocab";

export interface InstantGloss {
  translation: string;
  pronunciation: string;
}

type Glossary = Map<string, InstantGloss>;
interface GlossRow { word?: unknown; translation?: unknown; pronunciation?: unknown }

const PAGE = 1000;
const MAX_ROWS = 12000;
const loads = new Map<string, Promise<Glossary>>();
const ready = new Map<string, Glossary>();

const keyFor = (from: string, to: string) => `${(from || "").toLowerCase()}>${(to || "").toLowerCase()}`;

async function fetchPage(from: string, to: string, offset: number, withPronunciation: boolean) {
  return supabase
    .from("vocab_translations")
    .select(withPronunciation ? "word, translation, pronunciation" : "word, translation")
    .eq("language", from)
    .eq("native_language", to)
    .order("word", { ascending: true })
    .range(offset, offset + PAGE - 1);
}

async function fetchGlossary(from: string, to: string): Promise<Glossary> {
  const map: Glossary = new Map();
  // `pronunciation` arrives with the 2026-10-29 migration; if it hasn't run
  // yet, fall back to translations only rather than loading nothing.
  let withPronunciation = true;
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    let res = await fetchPage(from, to, offset, withPronunciation);
    if (res.error && withPronunciation) {
      withPronunciation = false;
      res = await fetchPage(from, to, offset, false);
    }
    if (res.error || !res.data) break;
    const rows = res.data as unknown as GlossRow[];
    for (const row of rows) {
      const key = normalizeToken(String(row.word || ""));
      if (!key || map.has(key)) continue;
      map.set(key, { translation: String(row.translation || ""), pronunciation: String(row.pronunciation || "") });
    }
    if (rows.length < PAGE) break;
  }
  return map;
}

/** Start loading the dictionary for a language pair (safe to call repeatedly). */
export function preloadGlossary(from: string, to: string): Promise<Glossary> {
  const key = keyFor(from, to);
  let p = loads.get(key);
  if (!p) {
    p = fetchGlossary(from.toLowerCase(), to.toLowerCase())
      .then((m) => { ready.set(key, m); return m; })
      .catch(() => { loads.delete(key); return new Map() as Glossary; });
    loads.set(key, p);
  }
  return p;
}

function find(map: Glossary, word: string): InstantGloss | null {
  const exact = map.get(normalizeToken(word));
  if (exact?.translation) return exact;
  // French elision: "l'argent" → "argent", "qu'importe" → "importe".
  const parts = word.split(/['’]/);
  if (parts.length > 1) {
    const tail = map.get(normalizeToken(parts[parts.length - 1]));
    if (tail?.translation) return tail;
  }
  return null;
}

/**
 * Meaning of a single tapped word from the curated dictionary, or null if it
 * isn't one of the common words. Waits at most `waitMs` for a first load.
 */
export async function instantGloss(word: string, from: string, to: string, waitMs = 1500): Promise<InstantGloss | null> {
  const text = (word || "").trim();
  if (!text || /\s/.test(text) || !from || !to || from.toLowerCase() === to.toLowerCase()) return null;
  const key = keyFor(from, to);
  const loaded = ready.get(key);
  if (loaded) return find(loaded, text);
  const map = await Promise.race([
    preloadGlossary(from, to),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
  return map ? find(map, text) : null;
}
