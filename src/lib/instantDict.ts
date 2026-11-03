// Instant word meanings, like Language Reactor: a tap is answered from memory
// on the device, with no network.
//
//  1. Built-in pack: public/dict/<from>-<to>.v1.json — the 15,000 most common
//     words of film/TV subtitles with meanings (scripts/build-instant-dict.mjs).
//     ~120 kB gzipped, loaded once when a video in that language opens, then
//     served from the browser cache.
//  2. Per video: when subtitles load, every word of the video that the pack
//     doesn't know is looked up in the shared dictionary (one query per 200
//     words), then the rest with Google in one batch, and remembered on the
//     device (localStorage), so by the time the learner taps, it's local.
//  3. Each subtitle line's translation is remembered too, so "context"
//     needs no request either.
import { supabase } from "@/integrations/supabase/client";

export const PACKS = new Set(["fr-en"]);
const STORE = (pair: string) => `ls.instantDict.${pair}.v1`;
const MAX_EXTRA = 8000;

const packs = new Map<string, Map<string, string>>();
const packLoads = new Map<string, Promise<Map<string, string> | null>>();
const extras = new Map<string, Map<string, string>>();
const lineMeanings = new Map<string, string>();

export const dictKey = (raw: string) =>
  String(raw || "")
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, "")
    .trim();
const base = (c: string) => (c || "").toLowerCase().split("-")[0];
const pairOf = (from: string, to: string) => `${base(from)}-${base(to)}`;
const flat = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");
const isEcho = (t: string, w: string) => !t.trim() || flat(t) === flat(w);

function extraMap(pair: string): Map<string, string> {
  let m = extras.get(pair);
  if (!m) {
    m = new Map();
    try { for (const [k, v] of JSON.parse(localStorage.getItem(STORE(pair)) || "[]")) m.set(k, v); } catch { /* private mode */ }
    extras.set(pair, m);
  }
  return m;
}
let saveTimer = 0;
function persist(pair: string) {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const m = extraMap(pair);
    const entries = Array.from(m.entries()).slice(-MAX_EXTRA);
    try { localStorage.setItem(STORE(pair), JSON.stringify(entries)); } catch { /* full: memory still works */ }
  }, 1500);
}

/** Loads the built-in pack for this pair (once). Resolves null if there is none. */
export function loadPack(from: string, to: string): Promise<Map<string, string> | null> {
  const pair = pairOf(from, to);
  if (!PACKS.has(pair)) return Promise.resolve(null);
  const have = packs.get(pair);
  if (have) return Promise.resolve(have);
  let p = packLoads.get(pair);
  if (!p) {
    p = fetch(`/dict/${pair}.v1.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.words) return null;
        const m = new Map<string, string>(Object.entries(j.words as Record<string, string>));
        packs.set(pair, m);
        return m;
      })
      .catch(() => { packLoads.delete(pair); return null; });
    packLoads.set(pair, p);
  }
  return p;
}

// French words the frequency list splits at the apostrophe.
const FR_WHOLE: Record<string, string> = {
  "aujourd'hui": "today", "d'accord": "okay", "quelqu'un": "someone", "qu'est-ce": "what is", "qu'est-ce que": "what",
  "c'est": "it is", "c'était": "it was", "j'ai": "I have", "j'étais": "I was", "j'aime": "I like", "n'est": "is not",
  "s'il": "if he", "qu'il": "that he", "qu'elle": "that she", "jusqu'à": "until", "lorsqu'il": "when he", "presqu'": "almost",
};

/** The meaning, right now, from memory — or null. Never touches the network. */
export function instantMeaning(word: string, from: string, to: string): string | null {
  const pair = pairOf(from, to);
  const k = dictKey(word); // same key as the app and the shared dictionary (no apostrophes)
  if (!k || base(from) === base(to)) return null;
  const get = (key: string) => extraMap(pair).get(key) ?? packs.get(pair)?.get(key);
  const hit = get(k);
  if (hit) return hit;
  if (pair === "fr-en") {
    // Apostrophe words, read from the word as written: c'est, l'homme, j'arrive.
    const raw = word.toLowerCase().replace(/’/g, "'").replace(/[.,!?;:"`«»()\[\]…]/g, "").trim();
    if (FR_WHOLE[raw]) return FR_WHOLE[raw];
    const m = raw.match(/^(c|j|l|d|n|s|m|t|qu|jusqu|lorsqu|puisqu)'(.+)$/);
    if (m) {
      const rest = get(dictKey(m[2]));
      if (rest) return rest; // quick guess until the video prefetch brings the exact meaning
    }
  }
  return null;
}

/** Remember a meaning found another way (server, Google) for next time. */
export function rememberMeaning(word: string, from: string, to: string, meaning: string) {
  const k = dictKey(word);
  if (!k || !meaning || isEcho(meaning, word) || /\s/.test(k)) return;
  const pair = pairOf(from, to);
  const m = extraMap(pair);
  if (m.get(k) === meaning) return;
  m.set(k, meaning);
  persist(pair);
}

/** The translation of a subtitle line we already have, if any. */
export const lineMeaning = (line: string) => lineMeanings.get(line.trim()) ?? null;

async function googleBatch(words: string[], from: string, to: string): Promise<string[]> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${base(from)}&tl=${base(to)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ q: words.join("\n") }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const text = (Array.isArray(data?.[0]) ? data[0] : []).map((p: unknown[]) => (typeof p?.[0] === "string" ? p[0] : "")).join("");
  return text.split("\n").map((s: string) => s.trim());
}

/**
 * Get every word of a video ready before the learner taps. Safe to call more
 * than once; does nothing for words already known. Never throws.
 */
export async function prefetchVideo(lines: { primary: string; secondary?: string }[], from: string, to: string) {
  try {
    for (const l of lines) if (l.primary && l.secondary) lineMeanings.set(l.primary.trim(), l.secondary.trim());
    if (base(from) === base(to)) return;
    await loadPack(from, to);
    const pair = pairOf(from, to);
    const want = new Map<string, string>(); // key (no apostrophes) → word as written, for Google
    for (const l of lines) for (const raw of (l.primary || "").split(/\s+/)) {
      const k = dictKey(raw);
      // Exact entries only: apostrophe words get their real meaning even when a guess exists.
      if (k && /\p{L}/u.test(k) && !want.has(k) && !(extraMap(pair).has(k) || packs.get(pair)?.has(k)))
        want.set(k, raw.toLowerCase().replace(/’/g, "'").replace(/[.,!?;:"`«»()\[\]…]/g, "").trim());
    }
    let missing = Array.from(want.keys()).slice(0, 1500);
    if (!missing.length) return;

    // Shared dictionary first (every word any learner has looked up).
    for (let i = 0; i < missing.length; i += 200) {
      const chunk = missing.slice(i, i + 200);
      const { data } = await (supabase as any).from("word_dictionary").select("word, translation")
        .eq("language", base(from)).eq("target", base(to)).in("word", chunk);
      for (const r of (data as { word: string; translation: string }[] | null) ?? []) rememberMeaning(r.word, from, to, r.translation);
    }
    missing = missing.filter((k) => !extraMap(pair).has(k));

    // Then Google, one word per line, ~80 words per request.
    for (let i = 0; i < missing.length; i += 80) {
      const chunk = missing.slice(i, i + 80);
      const got = await googleBatch(chunk.map((k) => want.get(k) || k), from, to).catch(() => [] as string[]);
      if (got.length === chunk.length) chunk.forEach((w, j) => rememberMeaning(w, from, to, got[j]));
    }
  } catch { /* the tap path still works without the prefetch */ }
}
