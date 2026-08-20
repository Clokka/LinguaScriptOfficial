// Pure helpers for the Active Recall exercise: grading, hint masking, and
// blanking the target word out of its carrier sentence. No DB calls here —
// keep this trivially testable, same discipline as progressStats.ts.

/**
 * Leading articles to strip before comparing an answer, keyed by language.
 * Deliberately not exhaustive — covering the common single-word articles in
 * the Romance and Germanic languages LinguaScript supports is enough to stop
 * "le mensonge" failing against "mensonge". Languages with no articles (or
 * none listed yet) simply skip this step.
 */
const LEADING_ARTICLES: Record<string, string[]> = {
  // "l" rather than "l'" — the elision apostrophe is turned into a space
  // before this list is checked (see normalizeAnswer), so by the time it
  // runs, "l'école" already reads as "l ecole".
  fr: ["les", "le", "la", "l", "un", "une", "des", "du"],
  es: ["los", "las", "el", "la", "un", "una", "unos", "unas"],
  it: ["gli", "il", "lo", "la", "i", "le", "un", "uno", "una"],
  pt: ["os", "as", "o", "a", "um", "uma", "uns", "umas"],
  de: ["der", "die", "das", "ein", "eine", "einen", "einem", "einer", "eines"],
  nl: ["de", "het", "een"],
};

/**
 * Normalise an answer for comparison: strip diacritics, case, punctuation,
 * collapse whitespace, and drop one leading article if the language has them.
 *
 * Applied to both the learner's answer and the target word, so "déteste"
 * matches "deteste" and "le mensonge" matches "mensonge" without either side
 * needing special-casing.
 */
export function normalizeAnswer(raw: string, language: string): string {
  let s = raw
    .normalize("NFD")
    // Combining diacritical marks (U+0300-U+036F), written as an explicit
    // escape rather than the literal characters — the literal range is
    // invisible in a diff and easy to corrupt via copy-paste or encoding.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    // Elisions ("l'école", "qu'il", "un'idea") turn into a space rather than
    // vanishing. Stripping the apostrophe outright, as the punctuation pass
    // below does to every other mark, would fuse "l'" onto the next word into
    // one token — "lecole" — which the article list below could never match
    // and which would no longer equal the bare target word either.
    .replace(/['’]/g, " ")
    .replace(/[.,!?;:"“”«»()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const articles = LEADING_ARTICLES[language];
  if (articles) {
    for (const a of articles) {
      if (s === a) {
        s = "";
        break;
      }
      if (s.startsWith(`${a} `)) {
        s = s.slice(a.length + 1);
        break;
      }
    }
  }
  return s.trim();
}

export function answersMatch(userAnswer: string, target: string, language: string): boolean {
  const a = normalizeAnswer(userAnswer, language);
  const b = normalizeAnswer(target, language);
  return a.length > 0 && a === b;
}

/**
 * Blank every occurrence of the target word out of its carrier sentence.
 *
 * Active Recall is supposed to test retrieval from meaning alone, and the
 * sentence handed to it is the one the word was saved from — which means the
 * answer was sitting in plain view directly under the prompt. Comparison is
 * done through the same normaliser as grading, so "mensonge" still matches
 * "Mensonge" at the start of a sentence or "mensonge," before a comma.
 */
export function blankTargetInSentence(sentence: string, targetWord: string, language: string): string {
  const targetNorm = normalizeAnswer(targetWord, language);
  if (!targetNorm) return sentence;

  return sentence
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token) || token.length === 0) return token;
      const lead = token.match(/^[.,!?;:"'‘’“”«»()]*/)?.[0] ?? "";
      const trail = token.match(/[.,!?;:"'‘’“”«»()]*$/)?.[0] ?? "";
      const core = token.slice(lead.length, token.length - trail.length || undefined);
      if (normalizeAnswer(core, language) === targetNorm) {
        return `${lead}_____${trail}`;
      }
      return token;
    })
    .join("");
}

/**
 * Reveal the first `revealCount` characters of `word`, masking the rest.
 * Whitespace is always shown so a multi-word answer's shape isn't hidden.
 */
export function maskWord(word: string, revealCount: number): string {
  let shown = 0;
  return word
    .split("")
    .map((ch) => {
      if (/\s/.test(ch)) return ch;
      if (shown < revealCount) {
        shown += 1;
        return ch;
      }
      return "_";
    })
    .join(" ");
}

/**
 * The outcome of one Active Recall attempt, and what it's worth.
 *
 * A clean recall (no hints) is the strongest evidence a learner knows a word,
 * so it alone promotes the deck. A hinted success still earns XP — retrieval
 * with a hint builds memory — but holds the word's current position. Giving
 * up (the answer was revealed) earns nothing and holds too: nothing was
 * retrieved, hint or not.
 */
export type RecallOutcome = "clean" | "assisted" | "revealed";

/**
 * XP for one Active Recall attempt. A clean recall is worth the most because
 * it is the only outcome that promotes the deck. An assisted recall still
 * pays out — retrieval with a hint is real work — but less per hint taken, so
 * reaching for help earlier costs more than reaching for it later.
 */
export function recallXp(outcome: RecallOutcome, hintsUsed: number): number {
  if (outcome === "clean") return 25;
  if (outcome === "assisted") return Math.max(5, 15 - hintsUsed * 5);
  return 0;
}

/**
 * Chameleon tier for the current attempt state — mirrors the deck it feeds.
 *
 * A resolved attempt maps directly onto its outcome: clean is green, assisted
 * is orange, revealed is red — total failure to retrieve, hint or not, reads
 * the same as never having met the word. While still mid-attempt (outcome is
 * null), the chameleon turns orange the moment a hint is shown, so the
 * learner sees the state change at the point they asked for help rather than
 * only once the exercise resolves.
 */
export function tierForRecall(hintsUsed: number, outcome: RecallOutcome | null): "red" | "orange" | "green" {
  if (outcome === "clean") return "green";
  if (outcome === "assisted") return "orange";
  if (outcome === "revealed") return "red";
  return hintsUsed > 0 ? "orange" : "red";
}

export const MAX_HINTS = 2;
