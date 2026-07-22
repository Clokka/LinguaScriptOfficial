/**
 * Felix the Chameleon color mapping system
 * Maps languages to RGB colors that Felix will change to
 */

export interface ColorValue {
  r: number;
  g: number;
  b: number;
}

/**
 * Language → Color mapping
 * Groups languages by color families:
 * - Red: Romance languages (Spanish, Portuguese, Italian, French, Romanian)
 * - Orange: Germanic languages (German, Dutch, Swedish, Norwegian, Danish, etc.)
 * - Green: Other major languages (English, Japanese, Chinese, Korean, Russian, Arabic, Hindi, Turkish, Polish, etc.)
 */
export const LANGUAGE_COLORS: Record<string, ColorValue> = {
  // RED - Romance languages
  es: { r: 239, g: 68, b: 68 },      // Spanish
  pt: { r: 239, g: 68, b: 68 },      // Portuguese
  it: { r: 239, g: 68, b: 68 },      // Italian
  fr: { r: 239, g: 68, b: 68 },      // French
  ro: { r: 239, g: 68, b: 68 },      // Romanian
  ca: { r: 239, g: 68, b: 68 },      // Catalan

  // ORANGE - Germanic languages
  de: { r: 249, g: 115, b: 22 },     // German
  nl: { r: 249, g: 115, b: 22 },     // Dutch
  sv: { r: 249, g: 115, b: 22 },     // Swedish
  no: { r: 249, g: 115, b: 22 },     // Norwegian
  da: { r: 249, g: 115, b: 22 },     // Danish
  en: { r: 249, g: 115, b: 22 },     // English

  // GREEN - Asian & other languages
  ja: { r: 34, g: 197, b: 94 },      // Japanese
  zh: { r: 34, g: 197, b: 94 },      // Chinese
  ko: { r: 34, g: 197, b: 94 },      // Korean
  ru: { r: 34, g: 197, b: 94 },      // Russian
  ar: { r: 34, g: 197, b: 94 },      // Arabic
  hi: { r: 34, g: 197, b: 94 },      // Hindi
  tr: { r: 34, g: 197, b: 94 },      // Turkish
  pl: { r: 34, g: 197, b: 94 },      // Polish
  th: { r: 34, g: 197, b: 94 },      // Thai
  vi: { r: 34, g: 197, b: 94 },      // Vietnamese
};

/**
 * Get the color for a given language code
 * Defaults to green if language is not mapped
 */
export function getLanguageColor(languageCode: string): ColorValue {
  const normalized = (languageCode || "").toLowerCase();
  return LANGUAGE_COLORS[normalized] || { r: 34, g: 197, b: 94 }; // Default green
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(color: ColorValue): string {
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Get the human-readable color name for a language
 */
export function getColorName(color: ColorValue): string {
  if (color.r > 200 && color.g < 100 && color.b < 100) return "red";
  if (color.r > 200 && color.g > 80 && color.g < 130 && color.b < 50) return "orange";
  return "green";
}
