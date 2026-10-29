import { supabase } from "@/integrations/supabase/client";
// Last-resort translation straight from the learner's browser (Google's free
// "gtx" endpoint, CORS-open, no key). Used only when the translate-word /
// translate-subtitles edge functions fail — AI credits gone, Gemini key
// wrong, or the server's own free fallback blocked from a data-centre IP. A
// learner's phone is never blocked the way a server can be, so a tapped word
// always gets a meaning instead of "Couldn't translate".

/** App language code ("fr", "zh", "pt") → Google code. */
function googleCode(code: string): string {
  const c = (code || "").toLowerCase();
  if (c.startsWith("zh")) return "zh-CN";
  return c || "auto";
}

export interface BrowserTranslation {
  text: string;
  /** Romanization of the source (pinyin, romaji…), empty for Latin scripts. */
  romanization: string;
}

export async function browserTranslate(text: string, from: string, to: string): Promise<BrowserTranslation> {
  try {
    return await browserTranslateOnce(text, from, to);
  } catch {
    // Google's free endpoint sometimes turns a busy phone away (429) for a
    // moment; one short retry usually gets through.
    await new Promise((r) => setTimeout(r, 800));
    return browserTranslateOnce(text, from, to);
  }
}

async function browserTranslateOnce(text: string, from: string, to: string): Promise<BrowserTranslation> {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=rm` +
    `&sl=${encodeURIComponent(googleCode(from))}&tl=${encodeURIComponent(googleCode(to))}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ q: text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Translation failed: ${res.status}`);
  const data = await res.json();
  const parts: unknown[][] = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = parts.map((p) => (typeof p?.[0] === "string" ? p[0] : "")).join("");
  const romanization = parts
    .map((p) => (p?.[0] == null && typeof p?.[3] === "string" ? p[3] : ""))
    .join("")
    .trim();
  return { text: translated.trim(), romanization };
}

/** Translates subtitle lines in order, batched to keep requests small. */
export async function browserTranslateLines(lines: string[], from: string, to: string): Promise<string[]> {
  const out: string[] = new Array(lines.length).fill("");
  const MAX_CHARS = 3500;
  let start = 0;
  while (start < lines.length) {
    let end = start;
    let size = 0;
    while (end < lines.length && (end === start || size + lines[end].length + 1 <= MAX_CHARS)) {
      size += lines[end].length + 1;
      end++;
    }
    const batch = lines.slice(start, end).map((l) => l.replace(/\n/g, " "));
    const { text } = await browserTranslate(batch.join("\n"), from, to);
    const translated = text.split("\n");
    if (translated.length === batch.length) {
      translated.forEach((t, i) => { out[start + i] = t.trim(); });
    } else {
      for (let i = 0; i < batch.length; i++) {
        try { out[start + i] = (await browserTranslate(batch[i], from, to)).text; } catch { /* leave blank */ }
      }
    }
    start = end;
  }
  return out;
}

const SERVER_TIMEOUT_MS = 8000;

/** The popup's loading/error text — never a real meaning to save on a card. */
export function isPlaceholderMeaning(text: string | null | undefined, word?: string | null): boolean {
  const t = (text || "").trim();
  if (!t || /^(Translating|Couldn't translate)/i.test(t)) return true;
  // A "translation" that's just the word again (the translator gave up) is no
  // meaning at all — it made flashcards show the same word on both sides.
  if (word) {
    const flat = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");
    if (flat(t) === flat(word)) return true;
  }
  return false;
}

export interface WordTranslation {
  translation: string;
  pronunciation: string;
  ipa: string;
  contextTranslation: string;
  lemma: string | null;
  lemmaTranslation: string | null;
  pos: string | null;
  isInflected: boolean;
  grammarNote: string | null;
}

/**
 * Translate a tapped word (or phrase): the translate-word edge function first
 * (it adds lemma, part of speech and grammar notes), then the browser fallback
 * if the server fails or returns nothing. Throws only if both fail.
 * `from` / `to` are app language codes ("ja", "en").
 *
 * Fastest path first: the shared word dictionary (the 10,000 most common
 * words per language + every word looked up before) is read straight from
 * the database — no function start-up, no translator.
 */
export async function translateWord(
  invoke: (body: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>,
  word: string,
  context: string,
  from: string,
  to: string,
  labels: { from: string; to: string },
): Promise<WordTranslation> {
  const hit = await dictionaryLookup(word, from, to);
  if (hit) {
    const ctx = context && context !== word
      ? await Promise.race([
          browserTranslate(context, from, to).then((r) => r.text).catch(() => ""),
          new Promise<string>((r) => setTimeout(() => r(""), 1500)),
        ])
      : "";
    return { ...hit, contextTranslation: ctx };
  }
  try {
    // A slow server shouldn't keep the learner on "Translating…": after
    // SERVER_TIMEOUT_MS the browser translates instead.
    const res = await Promise.race([
      invoke({ word, context, fromLanguage: labels.from, toLanguage: labels.to }),
      new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("translate-word timed out") }), SERVER_TIMEOUT_MS),
      ),
    ]);
    const error = res.error;
    const data = res.data as Partial<Record<keyof WordTranslation, string | boolean>> | null;
    if (!error && typeof data?.translation === "string" && data.translation) {
      return {
        translation: data.translation,
        pronunciation: String(data.pronunciation || ""),
        ipa: String(data.ipa || ""),
        contextTranslation: String(data.contextTranslation || ""),
        lemma: data.lemma ? String(data.lemma) : null,
        lemmaTranslation: data.lemmaTranslation ? String(data.lemmaTranslation) : null,
        pos: data.pos ? String(data.pos) : null,
        isInflected: !!data.isInflected,
        grammarNote: data.grammarNote ? String(data.grammarNote) : null,
      };
    }
    console.warn("translate-word failed, translating in the browser:", error);
  } catch (e) {
    console.warn("translate-word failed, translating in the browser:", e);
  }
  const [w, ctx] = await Promise.all([
    browserTranslate(word, from, to),
    context && context !== word ? browserTranslate(context, from, to).catch(() => null) : Promise.resolve(null),
  ]);
  if (!w.text) throw new Error("No translation");
  return {
    translation: w.text,
    pronunciation: w.romanization,
    ipa: "",
    contextTranslation: ctx?.text || (context === word ? w.text : ""),
    lemma: null,
    lemmaTranslation: null,
    pos: null,
    isInflected: false,
    grammarNote: null,
  };
}

/** The shared dictionary (public.word_dictionary), or null on a miss. */
async function dictionaryLookup(word: string, from: string, to: string): Promise<WordTranslation | null> {
  const key = word
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, "")
    .trim();
  const lang = (from || "").toLowerCase().split("-")[0];
  const target = (to || "").toLowerCase().split("-")[0];
  if (!key || !lang || !target || lang === target) return null;
  try {
    const { data } = await Promise.race([
      (supabase as any)
        .from("word_dictionary")
        .select("translation, lemma, pos, ipa, pronunciation")
        .eq("language", lang)
        .eq("word", key)
        .eq("target", target)
        .maybeSingle(),
      new Promise<{ data: null }>((r) => setTimeout(() => r({ data: null }), 1200)),
    ]);
    if (!data?.translation || isPlaceholderMeaning(data.translation, word)) return null;
    return {
      translation: data.translation,
      pronunciation: data.pronunciation || "",
      ipa: data.ipa || "",
      contextTranslation: "",
      lemma: data.lemma || null,
      lemmaTranslation: data.lemma ? data.translation : null,
      pos: data.pos || null,
      isInflected: !!data.lemma && data.lemma.toLowerCase() !== key,
      grammarNote: null,
    };
  } catch {
    return null; // table missing or offline → translate as before
  }
}
