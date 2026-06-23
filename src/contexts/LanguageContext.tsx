import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Strict BCP-47 mapping for the Web Speech API.
// Any language NOT in this map is unsupported by the TTS engine — we refuse to
// speak rather than fall back to an English voice.
const TTS_VOICE_MAP: Record<string, string> = {
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ar: "ar-SA",
  hi: "hi-IN",
  ru: "ru-RU",
  tr: "tr-TR",
  nl: "nl-NL",
  pl: "pl-PL",
  sv: "sv-SE",
  en: "en-US",
};

interface LanguageContextType {
  /**
   * THE SINGLE SOURCE OF TRUTH for language at runtime.
   * Resolver:
   *   Free user → profiles.active_learning_language
   *   Pro user  → currently selected language tab
   * Every downstream system (subtitles, flashcards, TTS, content filter)
   * MUST read from `languageContext`, never from profile/UI/inferred state.
   */
  languageContext: string;
  /** @deprecated alias for `languageContext`. Prefer `languageContext`. */
  learningLanguage: string;
  setLearningLanguage: (lang: string) => void;
  /** BCP-47 voice tag derived from `languageContext`. */
  ttsLang: string;
  /** Pro subscription flag (read from profiles.is_pro). */
  isPro: boolean;
  /**
   * Returns true when a piece of content (film) should be locked behind the
   * Pro upgrade because its language does not match the active language and
   * the user is not Pro. Returns false for content with no declared language.
   */
  isContentLocked: (filmLanguage?: string | null) => boolean;
  /**
   * Speak `text` strictly in `lang`. If `lang` is omitted, falls back to
   * `languageContext`. NEVER falls back to an English voice — if no matching
   * voice is installed, the call is a no-op (and logs a warning).
   */
  speak: (text: string, lang?: string) => Promise<void> | void;
}

const LanguageContext = createContext<LanguageContextType>({
  languageContext: "fr",
  learningLanguage: "fr",
  setLearningLanguage: () => {},
  ttsLang: "fr-FR",
  isPro: false,
  isContentLocked: () => false,
  speak: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [activeLanguage, setActiveLanguage] = useState(() => {
    return (localStorage.getItem("learningLanguage") || "fr").toLowerCase();
  });
  // Becomes true once we've resolved the language from the user's profile (or
  // confirmed there is no signed-in user). Until then we MUST NOT lock any
  // content — otherwise a freshly signed-up Spanish learner sees their Spanish
  // film blocked against the stale "fr" localStorage default during the
  // profile-fetch race.
  const [ready, setReady] = useState(false);

  const languageContext = activeLanguage;
  const ttsLang = TTS_VOICE_MAP[languageContext] || "fr-FR";

  const [isPro, setIsPro] = useState(false);

  // Sync from profile on login
  useEffect(() => {
    if (!user) { setIsPro(false); setReady(true); return; }
    setReady(false);
    supabase
      .from("profiles")
      .select("learning_language, is_pro, cef_level")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const lang = (data as any)?.learning_language?.toLowerCase();
        const level = (data as any)?.cef_level;
        if (lang) {
          setActiveLanguage(lang);
          localStorage.setItem("learningLanguage", lang);
          // Backfill green seed for the active language. Idempotent — only
          // inserts words not already saved, so it's safe to run on every
          // login and ensures language switches done before this code shipped
          // still get their A1–C1 head-start.
          if (level && level !== "below") {
            supabase.rpc("seed_known_vocabulary" as any, {
              _language: lang,
              _level: level,
            }).then(() => {});
          }
        }
        setIsPro(!!(data as any)?.is_pro);
        setReady(true);
      });
  }, [user]);

  const isContentLocked = (_filmLanguage?: string | null) => {
    // Content is never locked by language — users can watch any film regardless
    // of their active learning language or Pro status.
    return false;
  };

  const setLearningLanguage = (lang: string) => {
    const norm = (lang || "").toLowerCase();
    setActiveLanguage(norm);
    localStorage.setItem("learningLanguage", norm);
    if (user) {
      supabase
        .from("profiles")
        .update({ learning_language: norm })
        .eq("user_id", user.id)
        .then(() => {});
      // Seed known vocabulary for the newly-selected language based on the
      // user's CEFR level so switching to a new language doesn't drop them
      // back to 0% green. Idempotent server-side (ON CONFLICT DO NOTHING).
      supabase
        .from("profiles")
        .select("cef_level")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          const level = (data as any)?.cef_level;
          if (level && level !== "below") {
            supabase.rpc("seed_known_vocabulary" as any, {
              _language: norm,
              _level: level,
            }).then(() => {});
          }
        });
    }
  };

  const getVoicesAsync = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      const existing = window.speechSynthesis.getVoices();
      if (existing && existing.length) return resolve(existing);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(window.speechSynthesis.getVoices() || []);
      };
      window.speechSynthesis.onvoiceschanged = finish;
      try { window.speechSynthesis.getVoices(); } catch {}
      setTimeout(finish, 800);
    });
  };

  const speak = async (text: string, lang?: string) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();

      // Resolve language strictly: caller-provided > languageContext.
      // We do NOT consult any other state — no profile, no UI, no inference.
      const code = (lang || languageContext).toLowerCase();
      const targetLang = TTS_VOICE_MAP[code];

      if (!targetLang) {
        console.warn(
          `[speak] Language "${code}" is not in TTS_VOICE_MAP; refusing to speak "${text}" to avoid English fallback.`
        );
        return;
      }

      const baseLang = targetLang.split("-")[0];
      const voices = await getVoicesAsync();
      const match =
        voices.find((v) => v.lang?.toLowerCase() === targetLang.toLowerCase()) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(baseLang + "-")) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(baseLang));

      if (!match) {
        console.warn(
          `[speak] No ${targetLang} voice installed on this device; refusing to speak "${text}" (no English fallback).`
        );
        return;
      }

      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = match;
      utter.lang = match.lang;
      utter.rate = 0.95;
      utter.volume = 1;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.error("speak failed", e);
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        languageContext,
        learningLanguage: languageContext, // back-compat alias
        setLearningLanguage,
        ttsLang,
        isPro,
        isContentLocked,
        speak,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
