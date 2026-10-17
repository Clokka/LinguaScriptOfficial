import type { LearnLang } from "@/lib/landingSegment";

/**
 * One short subtitle line per learning language for the landing-page demo.
 * Every word has its own meaning so each flashcard has a real back.
 *
 * Rowan: to show your own recording for a language, paste its YouTube ID into
 * LANDING_VIDEO_BY_LANG below. Languages without one fall back to the animated demo.
 */

export interface DemoWord {
  w: string;
  m: string; // meaning shown on the back of the flashcard
}

export interface DemoLine {
  words: DemoWord[];
  translation: string;
  /** Languages written without spaces between words. */
  noSpaces?: boolean;
  /** Word to ring if the live top-50 list can't be loaded (a very common word). */
  target?: number;
}

const COFFEE_EN: Record<string, string> = {
  ja: "コーヒーを一杯ください。",
  th: "ขอกาแฟหนึ่งแก้วครับ",
  zh: "请给我一杯咖啡。",
  es: "Quisiera un café, por favor.",
  fr: "Je voudrais un café, s'il vous plaît.",
  pt: "Eu queria um café, por favor.",
  de: "Ich hätte gern einen Kaffee, bitte.",
  it: "Vorrei un caffè, per favore.",
  ko: "커피 한 잔 주세요.",
};

export function demoLine(lang: LearnLang, native: string): DemoLine {
  switch (lang) {
    case "fr":
      return { target: 2, translation: "I would like a coffee, please.", words: [
        { w: "Je", m: "I" }, { w: "voudrais", m: "would like" }, { w: "un", m: "a" },
        { w: "café,", m: "coffee" }, { w: "s'il vous plaît.", m: "please" },
      ] };
    case "es":
      return { target: 1, translation: "I would like a coffee, please.", words: [
        { w: "Quisiera", m: "I would like" }, { w: "un", m: "a" },
        { w: "café,", m: "coffee" }, { w: "por favor.", m: "please" },
      ] };
    case "de":
      return { target: 0, translation: "I'd like a coffee, please.", words: [
        { w: "Ich", m: "I" }, { w: "hätte gern", m: "would like" }, { w: "einen", m: "a" },
        { w: "Kaffee,", m: "coffee" }, { w: "bitte.", m: "please" },
      ] };
    case "it":
      return { target: 1, translation: "I would like a coffee, please.", words: [
        { w: "Vorrei", m: "I would like" }, { w: "un", m: "a" },
        { w: "caffè,", m: "coffee" }, { w: "per favore.", m: "please" },
      ] };
    case "pt":
      return { target: 0, translation: "I'd like a coffee, please.", words: [
        { w: "Eu", m: "I" }, { w: "queria", m: "would like" }, { w: "um", m: "a" },
        { w: "café,", m: "coffee" }, { w: "por favor.", m: "please" },
      ] };
    case "ja":
      return { target: 1, noSpaces: true, translation: "One coffee, please.", words: [
        { w: "コーヒー", m: "coffee" }, { w: "を", m: "(object marker)" },
        { w: "一杯", m: "one cup" }, { w: "ください。", m: "please give me" },
      ] };
    case "zh":
      return { target: 0, noSpaces: true, translation: "Please give me a cup of coffee.", words: [
        { w: "请", m: "please" }, { w: "给我", m: "give me" },
        { w: "一杯", m: "one cup" }, { w: "咖啡。", m: "coffee" },
      ] };
    case "th":
      return { target: 0, noSpaces: true, translation: "One cup of coffee, please.", words: [
        { w: "ขอ", m: "may I have" }, { w: "กาแฟ", m: "coffee" },
        { w: "หนึ่ง", m: "one" }, { w: "แก้ว", m: "cup / glass" }, { w: "ครับ", m: "(polite ending)" },
      ] };
    case "en":
    default:
      return { target: 2, translation: COFFEE_EN[native] ?? "", words: [
        { w: "I'd", m: "I would" }, { w: "like", m: "want (politely)" },
        { w: "a", m: "one" }, { w: "coffee,", m: "coffee" }, { w: "please.", m: "polite word" },
      ] };
  }
}

/** Your own LinguaScript screen recordings, one per language (YouTube IDs). */
export const LANDING_VIDEO_BY_LANG: Partial<Record<LearnLang, string>> = {
  // fr: "YOUTUBE_ID",
};
