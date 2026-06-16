import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  learningLanguage: string;
  setLearningLanguage: (lang: string) => void;
  ttsLang: string;
  speak: (text: string, langOverride?: string) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  learningLanguage: "fr",
  setLearningLanguage: () => {},
  ttsLang: "fr-FR",
  speak: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [learningLanguage, setLearningLanguageState] = useState(() => {
    return localStorage.getItem("learningLanguage") || "fr";
  });

  const ttsLang = TTS_VOICE_MAP[learningLanguage] || "fr-FR";

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
          setLearningLanguageState(data.learning_language);
          localStorage.setItem("learningLanguage", data.learning_language);
        }
      });
  }, [user]);

  const setLearningLanguage = (lang: string) => {
    setLearningLanguageState(lang);
    localStorage.setItem("learningLanguage", lang);
    // Persist to profile if logged in
    if (user) {
      supabase
        .from("profiles")
        .update({ learning_language: lang })
        .eq("user_id", user.id)
        .then(() => {});
    }
  };

  const speak = (text: string) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      // iOS Safari: must be called synchronously inside the user gesture.
      // Cancel any pending utterance so a tap always produces fresh audio.
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = ttsLang;
      utter.rate = 0.95;
      utter.volume = 1;

      const voices = window.speechSynthesis.getVoices();
      const match =
        voices.find((v) => v.lang === ttsLang) ||
        voices.find((v) => v.lang?.startsWith(ttsLang.split("-")[0]));
      if (match) utter.voice = match;

      // Some mobile browsers need a tick before speaking after cancel().
      window.speechSynthesis.speak(utter);

      // Fallback: if nothing started within 250ms, retry once (handles iOS race).
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          try { window.speechSynthesis.speak(utter); } catch {}
        }
      }, 250);
    } catch (e) {
      console.error("speak failed", e);
    }
  };

  return (
    <LanguageContext.Provider value={{ learningLanguage, setLearningLanguage, ttsLang, speak }}>
      {children}
    </LanguageContext.Provider>
  );
};
