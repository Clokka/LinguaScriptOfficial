/**
 * Learner-first-language meanings. core_vocabulary.translation is English;
 * vocab_translations overlays meanings in the learner's own first language
 * (e.g. Hindi for English words). English natives keep the core gloss.
 */
import { supabase } from "@/integrations/supabase/client";

const LANG_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", fr: "French", es: "Spanish", de: "German", it: "Italian",
  pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese", ar: "Arabic", ru: "Russian",
  th: "Thai", nl: "Dutch", tr: "Turkish", pl: "Polish", vi: "Vietnamese",
};
export const langName = (code: string) => LANG_NAMES[code?.toLowerCase()] || code || "English";

let cached: { uid: string; lang: string } | null = null;
/** The signed-in learner's first language code (defaults to "en"). */
export async function getNativeLanguage(userId?: string | null): Promise<string> {
  if (!userId) return "en";
  if (cached?.uid === userId) return cached.lang;
  const { data } = await supabase.from("profiles").select("native_language").eq("user_id", userId).maybeSingle();
  const lang = ((data as any)?.native_language || "en").toLowerCase();
  cached = { uid: userId, lang };
  return lang;
}

/**
 * Replace `translation` on each row with the learner's first-language meaning.
 * If the first language equals the target language nothing is shown twice.
 */
export async function overlayNative<T extends { word: string; translation?: string | null }>(
  rows: T[],
  language: string,
  native: string,
): Promise<T[]> {
  if (!rows.length || !native || native === "en") return rows;
  const words = Array.from(new Set(rows.map((r) => r.word)));
  const map = new Map<string, string>();
  for (let i = 0; i < words.length; i += 300) {
    const { data } = await supabase
      .from("vocab_translations" as any)
      .select("word, translation")
      .eq("language", language)
      .eq("native_language", native)
      .in("word", words.slice(i, i + 300));
    for (const r of (data as any[]) || []) map.set(r.word, r.translation);
  }
  return rows.map((r) => (map.has(r.word) ? { ...r, translation: map.get(r.word)! } : r));
}
