// Shared dictionary (public.word_dictionary) + fast Google translation.
//
// Order for every word: dictionary → Google (official API when
// GOOGLE_TRANSLATE_API_KEY is set, else the free endpoint) → AI only when
// Google gives the word straight back.
import { createClient } from "npm:@supabase/supabase-js@2";
import { freeTranslate, toLangCode } from "./freeTranslate.ts";

export interface DictEntry {
  language: string;
  word: string;
  target: string;
  translation: string;
  lemma?: string | null;
  pos?: string | null;
  ipa?: string | null;
  pronunciation?: string | null;
  rank?: number | null;
  source?: string;
}

/** 'French' | 'fr' | 'zh-CN' → 'fr' / 'zh' (the app's language codes). */
export const baseCode = (lang: string) => toLangCode(lang).split("-")[0].toLowerCase();

/** Same key the app uses (normalizeToken in src/lib/vocab.ts). */
export const dictKey = (raw: string) =>
  String(raw || "")
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, "")
    .trim();

/** "the translator gave up": same letters as the word. */
export function echoes(translation: string, word: string): boolean {
  const flat = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");
  return !translation?.trim() || flat(translation) === flat(word);
}

// Untyped on purpose: the functions have no generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
export function serviceDb(): any {
  if (!_db) {
    _db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
  }
  return _db;
}

export async function lookup(language: string, word: string, target: string): Promise<DictEntry | null> {
  try {
    const { data } = await serviceDb()
      .from("word_dictionary")
      .select("*")
      .eq("language", language)
      .eq("word", dictKey(word))
      .eq("target", target)
      .maybeSingle();
    return (data as DictEntry) || null;
  } catch {
    return null; // table not there yet → just translate
  }
}

export async function save(entries: DictEntry[]): Promise<void> {
  const rows = entries
    .filter((e) => e.word && e.translation && !echoes(e.translation, e.word))
    .map((e) => ({ ...e, word: dictKey(e.word), updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  const { error } = await serviceDb().from("word_dictionary").upsert(rows, { onConflict: "language,word,target" });
  if (error) console.warn("[dictionary] save failed", error.message);
}

/**
 * Translate many short texts at once, keeping order. Official Cloud
 * Translation API (fast, reliable, needs GOOGLE_TRANSLATE_API_KEY) when set;
 * otherwise the free endpoint, one newline-joined request per batch.
 */
export async function googleTranslateMany(texts: string[], from: string, to: string): Promise<string[]> {
  const key = Deno.env.get("GOOGLE_TRANSLATE_API_KEY");
  const out: string[] = new Array(texts.length).fill("");
  if (key) {
    for (let i = 0; i < texts.length; i += 100) {
      const q = texts.slice(i, i + 100);
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, source: toLangCode(from), target: toLangCode(to), format: "text" }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Google Translate API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      (data?.data?.translations || []).forEach((t: { translatedText: string }, j: number) => {
        out[i + j] = String(t.translatedText || "").trim();
      });
    }
    return out;
  }
  for (let i = 0; i < texts.length; i += 80) {
    const batch = texts.slice(i, i + 80).map((t) => t.replace(/\n/g, " "));
    const { text } = await freeTranslate(batch.join("\n"), from, to);
    const lines = text.split("\n");
    if (lines.length === batch.length) lines.forEach((l, j) => { out[i + j] = l.trim(); });
    else {
      // Lines got merged — fall back to one at a time for this batch.
      for (let j = 0; j < batch.length; j++) out[i + j] = (await freeTranslate(batch[j], from, to)).text;
    }
  }
  return out;
}

export async function googleTranslate(text: string, from: string, to: string): Promise<string> {
  return (await googleTranslateMany([text], from, to))[0] || "";
}
