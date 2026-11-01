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
 * Select a word or short phrase → "Save to LinguaScript": translated and saved
 * to the red deck (guest words when signed out).
 * - In the phone app it's an item in Android's own text menu (Copy · Paste ·
 *   Translate · Save to LinguaScript): mobile/plugins/withWebViewMenu.js +
 *   app/index.tsx call window.__lsSaveText(text).
 * - In a browser there's no such menu, so a small chip appears under the
 *   selection instead.
 * The translator loads only when something is saved.
 */
const MAX_WORDS = 6;
const inApp = () => !!(window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView;

/** The sentence around the current selection, for the flashcard's example. */
function selectionContext(fallback: string): string {
  const sel = window.getSelection();
  const node = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement;
  return (node?.closest("p, li, h1, h2, h3, span, div")?.textContent || fallback).replace(/\s+/g, " ").trim().slice(0, 300);
}

export function SelectionSave() {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const { award } = useXp();
  const [chip, setChip] = useState<{ text: string; context: string; x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);

  const saveText = async (raw: string, context: string) => {
    const text = raw.replace(/\s+/g, " ").trim();
    const word = normalizeToken(text).slice(0, 120);
    if (!word) return;
    if (!learningLanguage) {
      toast("Pick the language you're learning first");
      return;
    }
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
        text, context, learningLanguage, native,
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
            context,
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
        saveGuestWord({ word, translation, pronunciation: t?.pronunciation || "", ipa: t?.ipa || "", context, language: learningLanguage });
      }
      track("word_saved", { language: learningLanguage, source: inApp() ? "app_text_menu" : "text_select" });
      toast.success(`🔴 Saved: ${text}${translation ? ` = ${translation}` : ""}`);
      window.getSelection()?.removeAllRanges();
      setChip(null);
    } catch (e) {
      console.error("[SelectionSave]", e);
      toast.error("Couldn't save that — try again");
    } finally {
      setSaving(false);
    }
  };

  // The app's text menu calls this with the selected text.
  const saveRef = useRef(saveText);
  saveRef.current = saveText;
  useEffect(() => {
    const w = window as Window & { __lsSaveText?: (text: string) => void };
    w.__lsSaveText = (text: string) => { void saveRef.current(text, selectionContext(text)); };
    return () => { delete w.__lsSaveText; };
  }, []);

  // Browser only: show the chip under a short selection.
  useEffect(() => {
    if (inApp()) return;
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
      setChip({
        text,
        context: selectionContext(text),
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

  return (
    <button
      type="button"
      // Keep the selection while tapping (mousedown would clear it first).
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => { if (!saving) void saveText(chip.text, chip.context); }}
      disabled={saving}
      style={{ left: chip.x, top: chip.y }}
      className="fixed z-[1000] -translate-x-1/2 rounded-full bg-[#08080B] px-4 py-2 text-sm font-semibold text-white shadow-lg ring-2 ring-[#34C759] active:scale-95 disabled:opacity-70"
    >
      {saving ? "Saving…" : "＋ Save to LinguaScript"}
    </button>
  );
}
