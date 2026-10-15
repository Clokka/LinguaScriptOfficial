// Best-effort check that caption text is written in the script of `lang`.
// Mirrors subtitlesLookLikeWrongLanguage in src/lib/languages.ts — keep the
// two in sync. Catches tracks labelled as one language but written in
// another (e.g. a creator's English captions tagged as Chinese, or a provider
// handing back the only track it has), which otherwise show English on both
// subtitle lines.
type ScriptFamily = "latin" | "cyrillic" | "han" | "kana" | "hangul" | "arabic" | "devanagari" | "thai";

const LANGUAGE_SCRIPT_FAMILY: Record<string, ScriptFamily> = {
  en: "latin", fr: "latin", es: "latin", de: "latin", it: "latin", pt: "latin",
  nl: "latin", pl: "latin", sv: "latin", tr: "latin",
  ru: "cyrillic",
  zh: "han",
  ja: "kana",
  ko: "hangul",
  ar: "arabic",
  hi: "devanagari",
  th: "thai",
};

const SCRIPT_PATTERN: Record<ScriptFamily, RegExp> = {
  latin: /[A-Za-z]/g,
  cyrillic: /[Ѐ-ӿ]/g,
  han: /[一-鿿]/g,
  kana: /[぀-ヿ一-鿿]/g,
  hangul: /[가-힯]/g,
  arabic: /[؀-ۿ]/g,
  devanagari: /[ऀ-ॿ]/g,
  thai: /[฀-๿]/g,
};

// Pass `otherLang` (the video's learning language) when checking a native
// track: creators sometimes write it in both languages, which would show the
// learning language on both subtitle lines.
export function subtitlesLookLikeWrongLanguage(subs: { text: string }[], lang: string, otherLang?: string): boolean {
  const family = LANGUAGE_SCRIPT_FAMILY[(lang || "").toLowerCase().split("-")[0]];
  if (!family || !subs.length) return false;
  const sample = subs.slice(0, 10).map((s) => s.text).join(" ");
  const letters = sample.match(/\p{L}/gu) || [];
  if (letters.length < 15) return false;
  const matches = sample.match(SCRIPT_PATTERN[family]) || [];
  if (matches.length / letters.length < 0.2) return true;
  const other = LANGUAGE_SCRIPT_FAMILY[(otherLang || "").toLowerCase().split("-")[0]];
  // Chinese and Japanese share kanji, so their scripts can't be told apart.
  // Latin is skipped: names like "YouTube" are letter-heavy and would trip it.
  if (!other || other === "latin" || other === family || (family === "han" && other === "kana") || (family === "kana" && other === "han")) {
    return false;
  }
  const otherMatches = sample.match(SCRIPT_PATTERN[other]) || [];
  return otherMatches.length / letters.length >= 0.2;
}
