/**
 * Which language is this visitor probably learning?
 *
 * Privacy-safe guesses only, strongest signal first:
 *   1. They chose it on the page (saved on this device)
 *   2. The link that brought them: ?lang=th, ?seg=learn-thai, utm_campaign=thai_tiktok
 *   3. The page that sent them, e.g. our own /blog/learn-thai article
 *   4. Browser language + timezone: English speakers → French (most common
 *      choice for UK learners); everyone else → English
 *
 * Search Console only gives totals, never one person's searches, so search
 * terms reach us through landing URLs and ad campaigns, not per visitor.
 */

export type LearnLang = "fr" | "es" | "de" | "it" | "pt" | "ja" | "zh" | "th" | "en";

export const LEARN_LANGS: { code: LearnLang; label: string; flag: string }[] = [
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const KEY = "ls.learnLang.v1";
const CODES = LEARN_LANGS.map((l) => l.code) as string[];

const NAMES: [RegExp, LearnLang][] = [
  [/french|francais|français/, "fr"],
  [/spanish|espanol|español/, "es"],
  [/german|deutsch/, "de"],
  [/italian|italiano/, "it"],
  [/portuguese|portugues/, "pt"],
  [/japanese|nihongo/, "ja"],
  [/chinese|mandarin/, "zh"],
  [/thai/, "th"],
  [/english/, "en"],
];

function fromText(text: string): LearnLang | null {
  const t = text.toLowerCase();
  for (const [re, code] of NAMES) if (re.test(t)) return code;
  return null;
}

/** Why we picked it, kept so signups can be segmented later. */
export type LangReason = "chosen" | "link" | "referrer" | "browser";

export function guessLearnLang(): { lang: LearnLang; reason: LangReason } {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && CODES.includes(saved)) return { lang: saved as LearnLang, reason: "chosen" };
  } catch { /* storage blocked */ }

  const p = new URLSearchParams(window.location.search);
  const direct = (p.get("lang") || "").toLowerCase();
  if (CODES.includes(direct)) return { lang: direct as LearnLang, reason: "link" };
  const fromLink = fromText(`${p.get("seg") || ""} ${p.get("utm_campaign") || ""} ${p.get("utm_content") || ""} ${p.get("utm_term") || ""}`);
  if (fromLink) return { lang: fromLink, reason: "link" };

  const fromRef = document.referrer ? fromText(new URL(document.referrer).pathname) : null;
  if (fromRef) return { lang: fromRef, reason: "referrer" };

  const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
  return { lang: browser === "en" ? "fr" : "en", reason: "browser" };
}

export function saveLearnLang(lang: LearnLang) {
  try { localStorage.setItem(KEY, lang); } catch { /* storage blocked */ }
}

/** The visitor's own language, for the translation line when they're learning English. */
export function nativeLang(): string {
  return (navigator.language || "en").slice(0, 2).toLowerCase();
}
