import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useXp } from "@/contexts/XpContext";
import { normalizeToken } from "@/lib/vocab";
import { saveGuestWord } from "@/lib/guestWords";
import { getLanguageLabel } from "@/lib/languages";
import { track } from "@/lib/analytics";

/**
 * Select a word or short phrase on any LinguaScript page → a small
 * "＋ Save to LinguaScript" chip appears under it → tap: translated and saved
 * to the red deck (guest words when signed out). The same as Android's
 * "Save to LinguaScript" text menu, for text inside the app and on the web.
 * The translator loads only when the chip is tapped.
 */
const MAX_WORDS = 6;

export function SelectionSave() {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const { award } = useXp();
  const [chip, setChip] = useState<{ text: string; context: string; x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const read = () => {
      const sel = window.getSelection();
      const text = sel?.toString().replace(/\s+/g, " ").trim() || "";
      if (!sel || sel.rangeCount === 0 || !text || text.length > 80 || text.split(" ").length > MAX_WORDS || !/\p{L}/u.test(text)) {
        setChip(null);
        return;
      }
      // Not while typing in a box.
      const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      if (node?.closest("input, textarea, [contenteditable='true'], [data-no-select-save]")) { setChip(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) { setChip(null); return; }
      const context = (node?.closest("p, li, h1, h2, h3, span, div")?.textContent || text).replace(/\s+/g, " ").trim().slice(0, 300);
      // Under the selection: the phone's own copy/paste menu sits above it.
      setChip({
        text,
        context,
        x: Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90),
        y: Math.min(rect.bottom + 10, window.innerHeight - 56),
      });
    };
    const onChange = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(read, 250);
    };
    const hide = () => setChip(null);
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", hide);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (!chip || !learningLanguage) return null;

  const save = async () => {
    const word = normalizeToken(chip.text).slice(0, 120);
    if (!word || saving) return;
    setSaving(true);
    try {
      let native = (navigator.language || "en").slice(0, 2).toLowerCase();
      if (user) {
        const { data } = await supabase.from("profiles").select("native_language").eq("user_id", user.id).maybeSingle();
        if (data?.native_language) native = data.native_language;
      }
      const { translateWord } = await import("@/lib/browserTranslate");
      const t = await translateWord(
        (body) => supabase.functions.invoke("translate-word", { body }),
        chip.text, chip.context, learningLanguage, native,
        { from: getLanguageLabel(learningLanguage), to: getLanguageLabel(native) },
      ).catch(() => null);
      const translation = t?.translation || "";

      if (user) {
        const { data: existing } = await supabase
          .from("saved_words").select("id").eq("user_id", user.id).eq("language", learningLanguage).eq("word", word).limit(1);
        if (!existing?.length) {
          const { error } = await supabase.from("saved_words").insert({
            user_id: user.id,
            word,
            language: learningLanguage,
            translation,
            context: chip.context,
            ipa: t?.ipa || "",
            pronunciation: t?.pronunciation || "",
            next_review: new Date(Date.now() - 86400000).toISOString().split("T")[0],
            interval_days: 0,
            review_count: 0,
            ease_factor: 2.5,
            state: "red",
            is_phrase: /\s/.test(word),
          } as any);
          if (error) throw error;
          award("add_word");
        }
      } else {
        saveGuestWord({ word, translation, pronunciation: t?.pronunciation || "", ipa: t?.ipa || "", context: chip.context, language: learningLanguage });
      }
      track("word_saved", { language: learningLanguage, source: "text_select" });
      toast.success(`🔴 Saved: ${chip.text}${translation ? ` = ${translation}` : ""}`);
      window.getSelection()?.removeAllRanges();
      setChip(null);
    } catch (e) {
      console.error("[SelectionSave]", e);
      toast.error("Couldn't save that — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      // Keep the selection while tapping (mousedown would clear it first).
      onPointerDown={(e) => e.preventDefault()}
      onClick={save}
      disabled={saving}
      style={{ left: chip.x, top: chip.y }}
      className="fixed z-[1000] -translate-x-1/2 rounded-full bg-[#08080B] px-4 py-2 text-sm font-semibold text-white shadow-lg ring-2 ring-[#34C759] active:scale-95 disabled:opacity-70"
    >
      {saving ? "Saving…" : "＋ Save to LinguaScript"}
    </button>
  );
}
