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
