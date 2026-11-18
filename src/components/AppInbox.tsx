import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WordSavedSheet, type SavedWord } from "@/components/WordSavedSheet";
import { getLanguageLabel } from "@/lib/languages";
import { getGuestWords, saveGuestWord } from "@/lib/guestWords";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXp } from "@/contexts/XpContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { focusRingWords } from "@/lib/focusDeck";
import { applySrsReview, coerceDeckState, isBlue, loadDeckIndex, normalizeToken, promote, reviewDueAt } from "@/lib/vocab";
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
  // Bumped after lock-screen reviews are saved, so the phone gets a fresh deck.
  const [deckBump, setDeckBump] = useState(0);
  const [savedSheet, setSavedSheet] = useState<SavedWord[]>([]);
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

  // Signed out in the app: words still save (to the guest deck on this device),
  // instead of waiting in the inbox forever with no sign of anything.
  useEffect(() => {
    if (!(window as any).ReactNativeWebView || userId) return;
    let alive = true;
    (window as any).__lsInbox = (items: InboxItem[]) => {
      const lang = learningRef.current;
      if (!Array.isArray(items) || !items.length) return;
      if (!lang) {
        toast("Your saved words are waiting", { description: "Choose the language you're learning, and they'll save." });
        return;
      }
      const have = new Set(getGuestWords().filter((g) => g.language === lang).map((g) => g.word.toLowerCase()));
      const sheet: SavedWord[] = [];
      const done: number[] = [];
      for (const it of items) {
        const word = normalizeToken(String(it.word || "")).slice(0, 120);
        if (word && (it as any).kind !== "review") {
          const isNew = !have.has(word.toLowerCase());
          if (isNew) saveGuestWord({ word, translation: String(it.translation || "").slice(0, 300), pronunciation: "", ipa: "", context: String(it.context || "").slice(0, 500), language: lang });
          sheet.push({ word, translation: String(it.translation || ""), isNew });
          track("word_saved", { language: lang, source: "android_select", guest: true });
        }
        done.push(it.at);
      }
      toApp({ type: "inbox-saved", ats: done });
      if (sheet.length && alive) setSavedSheet(sheet);
    };
    toApp({ type: "inbox-ready" });
    return () => { alive = false; delete (window as any).__lsInbox; };
  }, [userId]);

  useEffect(() => {
    if (!(window as any).ReactNativeWebView || !userId) return;
    let alive = true;

    (window as any).__lsInbox = async (items: InboxItem[]) => {
      if (busy.current || !Array.isArray(items) || !items.length) return;
      busy.current = true;
      try {
        const { learning, native, list } = await languagesOf(userId);
        // Warm the instant-dict pack for this pair once, up front, so the
        // per-word lookup below can read it synchronously instead of each
        // word racing its own slow first-load network fetch.
        if (native && native !== learning) {
          try {
            const { loadPack } = await import("@/lib/instantDict");
            await Promise.race([loadPack(learning, native), new Promise((r) => setTimeout(r, 3000))]);
          } catch { /* falls back to the network lookup below */ }
        }
        const done: number[] = [];
        let saved = 0;
        let waiting = 0;
        const sheet: SavedWord[] = [];
        let reviewed = 0;
        for (const it of items) {
          const word = normalizeToken(String(it.word || "")).slice(0, 120);
          if (!word) { done.push(it.at); continue; }
          // ✨ An answer from the lock-screen gold widget: same rule as a
          // flashcard answer (promote + applySrsReview from review.ts).
          if (it.kind === "review") {
            const lang = String(it.language || learning).toLowerCase().split("-")[0];
            const { data: row, error } = await supabase
              .from("saved_words")
              .select("id,state,times_correct,ease_factor,interval_days,review_count")
              .eq("user_id", userId!)
              .eq("language", lang)
              .ilike("word", word.replace(/[%_\\]/g, "\\$&"))
              .limit(1)
              .maybeSingle();
            if (error) { console.error("[AppInbox] review lookup failed", error); continue; } // retried next open
            if (row) {
              const correct = it.correct === true;
              const prev = coerceDeckState(row.state);
              const next = promote(prev, correct);
              const patch: Record<string, unknown> = {
                state: next,
                times_correct: (row.times_correct ?? 0) + (correct ? 1 : 0),
                ...applySrsReview(row, correct, { wasGreen: prev === "green", isGreen: next === "green" }),
              };
              if (next !== prev) patch.state_changed_at = new Date().toISOString();
              const { error: upErr } = await supabase.from("saved_words").update(patch as never).eq("id", row.id).eq("user_id", userId!);
              if (upErr) { console.error("[AppInbox] review save failed", upErr); continue; }
              reviewed++;
            }
            done.push(it.at);
            continue;
          }
          // Detected language first if it's one you learn; otherwise your
          // learning language. Text in your own language is skipped.
          const detected = String(it.language || "").toLowerCase().split("-")[0];
          // Never drop a word silently. No learning language yet → it waits in the
          // inbox (the learner is told why). Your own language → shown as "not saved".
          if (!learning && !list.includes(detected)) { waiting++; continue; }
          if (detected && detected === native && !list.includes(detected)) {
            sheet.push({ word, translation: "", isNew: false, note: `That's ${getLanguageLabel(native)}, your own language, so it wasn't saved` });
            done.push(it.at);
            continue;
          }
          const lang = list.includes(detected) ? detected : learning;
          // No meaning from the phone (offline, or Save tapped early)? Look it up now.
          let translation = String(it.translation || "").slice(0, 300);
          if (!translation && native && native !== lang) {
            try {
              const { translateWord } = await import("@/lib/browserTranslate");
              const t = await Promise.race([
                translateWord((body) => supabase.functions.invoke("translate-word", { body }), word, String(it.context || ""), lang, native,
                  { from: getLanguageLabel(lang), to: getLanguageLabel(native) }),
                new Promise<null>((r) => setTimeout(() => r(null), 6000)),
              ]);
              translation = (t as any)?.translation || "";
            } catch { /* saved without a meaning; flashcards look it up later */ }
          }
          const { data: existing } = await supabase
            .from("saved_words").select("id, translation").eq("user_id", userId!).eq("language", lang).eq("word", word).limit(1);
          if (!existing?.length) {
            const { error } = await supabase.from("saved_words").insert({
              user_id: userId!,
              word,
              language: lang,
              translation,
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
            sheet.push({ word, translation, isNew: true });
            awardRef.current("add_word");
            track("word_saved", { language: lang, source: "android_select" });
          }
          else {
            const row = existing[0] as { id: string; translation: string | null };
            // Already saved, but without a meaning (saved offline, or before
            // this pair had a dictionary entry): fill it in now instead of
            // leaving the flashcard blank forever.
            if (translation && !row.translation) {
              const { error: fillErr } = await supabase.from("saved_words").update({ translation } as any).eq("id", row.id).eq("user_id", userId!);
              if (fillErr) console.error("[AppInbox] backfill failed", fillErr);
            }
            sheet.push({ word, translation: translation || row.translation || "", isNew: false });
          }
          done.push(it.at);
        }
        if (done.length) toApp({ type: "inbox-saved", ats: done });
        if (reviewed && alive) {
          toast.success(`✨ ${reviewed} review${reviewed === 1 ? "" : "s"} from your lock screen`);
          // The deck changed: send the phone a fresh copy so the widgets update.
          setDeckBump((n) => n + 1);
        }
        // Proof it worked: the "it's red now" sheet (first time: the whole colour journey).
        if (sheet.length && alive) setSavedSheet(sheet);
        if (waiting && alive) toast(`${waiting} word${waiting === 1 ? " is" : "s are"} waiting to be saved`, { description: "Choose the language you're learning (Profile), and they'll save next time you open the app." });
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
        words[key] = [w.state, due, tapped, isBlue(w as any) ? 1 : 0];
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
  }, [userId, learningNow, deckBump]);

  return savedSheet.length ? <WordSavedSheet words={savedSheet} onClose={() => setSavedSheet([])} /> : null;
}
