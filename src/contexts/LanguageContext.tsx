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
      // Some browsers need a nudge to populate voices
      try { window.speechSynthesis.getVoices(); } catch {}
      setTimeout(finish, 800);
    });
  };

  const speak = async (text: string, langOverride?: string) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();

      const code = (langOverride || learningLanguage).toLowerCase();
      const targetLang = TTS_VOICE_MAP[code] || code || ttsLang;
      const baseLang = targetLang.split("-")[0];

      const voices = await getVoicesAsync();
      const match =
        voices.find((v) => v.lang?.toLowerCase() === targetLang.toLowerCase()) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(baseLang + "-")) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(baseLang));

      if (!match) {
        console.warn(
          `[speak] No ${targetLang} voice installed on this device; skipping to avoid English fallback for "${text}".`
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
    <LanguageContext.Provider value={{ learningLanguage, setLearningLanguage, ttsLang, speak }}>
      {children}
    </LanguageContext.Provider>
  );
};
