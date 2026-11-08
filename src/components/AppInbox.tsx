import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXp } from "@/contexts/XpContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { focusRingWords } from "@/lib/focusDeck";
import { loadDeckIndex, normalizeToken, reviewDueAt } from "@/lib/vocab";
import { track } from "@/lib/analytics";
import type { BubbleDeckWords, InboxItem, SiteToAppMessage } from "@linguascript/core/bridge";

/**
 * Words saved on Android with "select text → LinguaScript" (in any app) wait
 * in an inbox on the phone. When the LinguaScript app opens this site, it hands
 * them over here and we put them in the red deck — same row the Chrome
 * extension saves.
 *
 *   app → site:  window.__lsInbox([{ word, translation, language, context, at }])
 *   site → app:  { type: "inbox-ready" } · { type: "langs", learning, native }
 *                { type: "inbox-saved", ats: [...] }  (app then deletes those)
 *
 * Only runs inside the app (window.ReactNativeWebView).
 */

const toApp = (msg: SiteToAppMessage) => {
  try { (window as any).ReactNativeWebView?.postMessage(JSON.stringify(msg)); } catch { /* not in the app */ }
};

export function AppInbox() {
  const { user } = useAuth();
  const { award } = useXp();
  const busy = useRef(false);
  const awardRef = useRef(award);
  awardRef.current = award;
  const userId = user?.id;
  // The language the site is using right now (onboarding choice, or what the
  // learner picked in settings). The profile row can lag behind it: right after
  // onboarding it may still hold the database default, and a settings switch
  // is written in the background — so the phone must follow THIS, not the row.
  const { learningLanguage } = useLanguage();
  const learningNow = (learningLanguage || "").toLowerCase();
  const learningRef = useRef(learningNow);
  learningRef.current = learningNow;

  const languagesOf = async (uid: string) => {
    const [{ data: prof }, { data: lps }] = await Promise.all([
      supabase.from("profiles").select("learning_language, native_language").eq("user_id", uid).maybeSingle(),
      (supabase as any).from("language_profiles").select("language").eq("user_id", uid),
    ]);
    const learning = learningRef.current || String((prof as any)?.learning_language || "").toLowerCase();
    const native = String((prof as any)?.native_language || "en").toLowerCase();
    const list = Array.from(new Set([...(lps || []).map((r: any) => String(r.language).toLowerCase()), learning].filter(Boolean)));
    return { learning, native, list };
  };

  useEffect(() => {
    if (!(window as any).ReactNativeWebView || !userId) return;
    let alive = true;

    (window as any).__lsInbox = async (items: InboxItem[]) => {
      if (busy.current || !Array.isArray(items) || !items.length) return;
      busy.current = true;
      try {
        const { learning, native, list } = await languagesOf(userId);
        const done: number[] = [];
        let saved = 0;
        for (const it of items) {
          const word = normalizeToken(String(it.word || "")).slice(0, 120);
          if (!word) { done.push(it.at); continue; }
          // Detected language first if it's one you learn; otherwise your
          // learning language. Text in your own language is skipped.
          const detected = String(it.language || "").toLowerCase().split("-")[0];
          const lang = list.includes(detected) ? detected : detected && detected === native ? "" : learning;
          if (!lang) { done.push(it.at); continue; }
          const { data: existing } = await supabase
            .from("saved_words").select("id").eq("user_id", userId!).eq("language", lang).eq("word", word).limit(1);
          if (!existing?.length) {
            const { error } = await supabase.from("saved_words").insert({
              user_id: userId!,
              word,
              language: lang,
              translation: String(it.translation || "").slice(0, 300),
              context: String(it.context || "").slice(0, 500),
              ipa: "",
              pronunciation: "",
              next_review: new Date(Date.now() - 86400000).toISOString().split("T")[0],
              interval_days: 0,
              review_count: 0,
              ease_factor: 2.5,
              state: "red",
              is_phrase: /\s/.test(word),
            } as any);
            if (error) { console.error("[AppInbox] save failed", error); continue; } // stays in the inbox, retried next open
            saved++;
            awardRef.current("add_word");
            track("word_saved", { language: lang, source: "android_select" });
          }
          done.push(it.at);
        }
        if (done.length) toApp({ type: "inbox-saved", ats: done });
        if (saved && alive) toast.success(`🔴 ${saved} word${saved === 1 ? "" : "s"} saved from your phone`);
      } finally {
        busy.current = false;
      }
    };

    toApp({ type: "inbox-ready" });

    return () => { alive = false; delete (window as any).__lsInbox; };
  }, [userId]);

  // The 🦎 bubble's copy of your deck (Android): word → [state, dueAt, tappedAt].
  // It works out gold on the phone with the same rule as isDueGold().
  // Sent again whenever the learning language changes, so the bubble reads
  // Chinese characters as soon as Chinese is chosen (not the old language).
  useEffect(() => {
    if (!(window as any).ReactNativeWebView || !userId) return;
    let current = true;

    const sendDeck = async (learning: string, native: string) => {
      if (!learning) return;
      const deck = await loadDeckIndex(userId!, learning);
      const words: BubbleDeckWords = {};
      deck.forEach((w, key) => {
        const due = reviewDueAt(w as any) ?? 0;
        const tapped = (w as any).green_revealed_at ? Date.parse((w as any).green_revealed_at) : 0;
        words[key] = [w.state, due, tapped];
      });
      // Unlearned words from the current Top-N block, ringed in "Common words" style.
      const common = (await focusRingWords(userId!, learning).catch(() => [] as string[])).filter((w) => !words[w]);
      // Meanings for orange + green words: the lock-screen gold word and the
      // home-screen widget show them without going online.
      const meanings: Record<string, string> = {};
      const { data: rows } = await supabase
        .from("saved_words")
        .select("word, translation")
        .eq("user_id", userId!)
        .eq("language", learning)
        .in("state", ["orange", "green"])
        .limit(3000);
      for (const r of rows || []) {
        const key = normalizeToken(r.word);
        if (key && r.translation) meanings[key] = r.translation;
      }
      // A newer language choice started its own send: drop this older one.
      if (!current) return;
      toApp({ type: "deck", language: learning, native, words, common, meanings });
    };

    languagesOf(userId)
      .then(({ learning, native }) => {
        if (!current) return;
        toApp({ type: "langs", learning, native });
        void sendDeck(learning, native).catch(() => {});
      })
      .catch(() => {});

    return () => { current = false; };
  }, [userId, learningNow]);

  return null;
}
