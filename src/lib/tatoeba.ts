import { supabase } from "@/integrations/supabase/client";

export interface TatoebaSentence {
  sentence: string;
  translation: string;
}

/** Three extra example sentences for a word, cached server-side after the first lookup. */
export async function fetchTatoebaSentences(
  word: string,
  language: string,
  nativeLanguage = "en",
): Promise<TatoebaSentence[]> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-tatoeba-sentences", {
      body: { word, language, nativeLanguage },
    });
    if (error) throw error;
    return Array.isArray(data?.sentences) ? data.sentences : [];
  } catch (err) {
    console.error("[tatoeba] failed to fetch example sentences:", err);
    return [];
  }
}
