export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "pl", label: "Polish", flag: "🇵🇱" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
] as const;

export const getLanguageLabel = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code;

export const getLanguageFlag = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.flag ?? "🌐";

/**
 * Languages written without spaces between words. These need an
 * `Intl.Segmenter` pass rather than whitespace splitting.
 */
export const UNSPACED_LANGUAGES = new Set(["th", "zh", "ja"]);

/**
 * Tokenise a line of text into word-like tokens. Falls back to whitespace
 * splitting when `Intl.Segmenter` is unavailable.
 */
export const segmentWords = (text: string, language: string): string[] => {
  const code = (language || "").toLowerCase();
  if (!text) return [];
  if (UNSPACED_LANGUAGES.has(code) && typeof Intl !== "undefined" && "Segmenter" in Intl) {
    try {
      const seg = new (Intl as any).Segmenter(code, { granularity: "word" });
      return Array.from(seg.segment(text) as Iterable<{ segment: string; isWordLike?: boolean }>)
        .filter((s) => s.isWordLike)
        .map((s) => s.segment);
    } catch {
      /* fall through */
    }
  }
  return text.split(/\s+/).filter(Boolean);
};

type ScriptFamily = "latin" | "cyrillic" | "han" | "kana" | "hangul" | "arabic" | "devanagari" | "thai";

const LANGUAGE_SCRIPT_FAMILY: Record<string, ScriptFamily> = {
  en: "latin", fr: "latin", es: "latin", de: "latin", it: "latin", pt: "latin",
  nl: "latin", pl: "latin", sv: "latin", tr: "latin",
  ru: "cyrillic",
  zh: "han",
  ja: "kana", // Japanese mixes kana + kanji; kana is what sets it apart from Chinese.
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

/**
 * Best-effort check that fetched captions are actually written in `langCode`
 * — a script sanity check, not a real language detector. YouTube's `tlang`
 * auto-translate (and some caption providers) sometimes silently hand back
 * the ORIGINAL track instead of erroring when a translation isn't available,
 * so a "native language" fetch can come back in a totally different
 * language with no error at all. We only flag drastic script mismatches
 * (e.g. Chinese characters where English/French text was requested) — a
 * language code with no known script mapping, or too little sampled text,
 * is never flagged.
 */
export function subtitlesLookLikeWrongLanguage(
  subs: { text: string }[],
  langCode: string,
): boolean {
  const family = LANGUAGE_SCRIPT_FAMILY[(langCode || "").toLowerCase()];
  if (!family || !subs.length) return false;
  const sample = subs.slice(0, 10).map((s) => s.text).join(" ");
  const letters = sample.match(/\p{L}/gu) || [];
  if (letters.length < 15) return false; // not enough text to judge reliably
  const matches = sample.match(SCRIPT_PATTERN[family]) || [];
  // A few stray foreign names/loanwords shouldn't trip this — only a
  // wholesale wrong script should.
  return matches.length / letters.length < 0.2;
}
