// "Save to my flashcards" from the A1 guide: same saved_words row as
// SelectionSave (red deck, one review ladder in packages/core/src/review.ts).
// Signed out → guest deck (src/lib/guestWords.ts), kept when they sign up.
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { saveGuestWord } from "@/lib/guestWords";
import { getLanguageLabel } from "@/lib/languages";
import { track } from "@/lib/analytics";

export async function saveA1Word(user: User | null, word: string, example: string): Promise<{ translation: string }> {
  let native = (navigator.language || "en").slice(0, 2).toLowerCase();
  if (user) {
    const { data } = await supabase.from("profiles").select("native_language").eq("user_id", user.id).maybeSingle();
    if (data?.native_language) native = data.native_language;
  }
  let translation = "";
  if (native !== "en") {
    const { translateWord } = await import("@/lib/browserTranslate");
    const t = await translateWord(
      (body) => supabase.functions.invoke("translate-word", { body }),
      word, example, "en", native, { from: getLanguageLabel("en"), to: getLanguageLabel(native) },
    ).catch(() => null);
    translation = t?.translation || "";
  }
  if (user) {
    const { data: existing } = await supabase.from("saved_words").select("id")
      .eq("user_id", user.id).eq("language", "en").eq("word", word).limit(1);
    if (!existing?.length) {
      const { error } = await supabase.from("saved_words").insert({
        user_id: user.id, word, language: "en", translation, context: example,
        ipa: "", pronunciation: "",
        next_review: new Date(Date.now() - 86400000).toISOString().split("T")[0],
        interval_days: 0, review_count: 0, ease_factor: 2.5, state: "red", is_phrase: /\s/.test(word),
      } as any);
      if (error) throw error;
    }
  } else {
    saveGuestWord({ word, translation, pronunciation: "", ipa: "", context: example, language: "en" });
  }
  track("word_saved", { language: "en", source: "a1_guide" });
  return { translation };
}
