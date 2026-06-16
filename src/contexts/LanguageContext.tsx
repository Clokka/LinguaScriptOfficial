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
    return localStorage.getItem("learningLanguage") || "fr";
  });

  // Resolver: today Free + Pro both read from active_learning_language.
  // When Pro multi-language tabs land, this becomes:
  //   isPro ? selectedTab : activeLanguage
  const languageContext = activeLanguage;
  const ttsLang = TTS_VOICE_MAP[languageContext] || "fr-FR";

  // Sync from profile on login
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("learning_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.learning_language) {
          setActiveLanguage(data.learning_language);
          localStorage.setItem("learningLanguage", data.learning_language);
        }
      });
  }, [user]);

  const setLearningLanguage = (lang: string) => {
    setActiveLanguage(lang);
    localStorage.setItem("learningLanguage", lang);
    if (user) {
      supabase
        .from("profiles")
        .update({ learning_language: lang })
        .eq("user_id", user.id)
        .then(() => {});
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
        speak,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
