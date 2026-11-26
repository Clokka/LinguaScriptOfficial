/**
 * Essential phrases blueprint, A1 → C2 (docs/plans/linguascript-builder.md).
 *
 * Each phrase is one high-usefulness "chunk" for one communicative function,
 * ordered the way the CEFR descriptors, the British Council/Eaquals Core
 * Inventory and (for Spanish) the Instituto Cervantes Plan Curricular order
 * functions: greet/introduce → likes → ask for things (A1), plans, past,
 * invitations (A2), opinions, advice, stories (B1), speculation, hypotheses,
 * persuasion (B2), hedging, concession, discourse control (C1), idiom, irony,
 * fine reformulation (C2). All phrases are written by LinguaScript.
 *
 * A phrase UNLOCKS when every one of its `keys` is in the learner's
 * flashcards (any colour). A key may list forms separated by "|"
 * ("gusta|gustan"). `parts` tags each chunk with its role (subject, verb,
 * object…) and `swap` is the slot drilled by substitution.
 *
 * The extension reads a copy (extension/dict/phrases/<lang>.json, written by
 * `node scripts/build-extension-coverage.mjs`) and has its own small copy of
 * phraseUnlocks() in background.js; keep them the same.
 */
import es from './es.json';
import fr from './fr.json';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export interface EssentialPhrase {
  id: string;
  level: CefrLevel;
  /** What the phrase does: "Say what you like", "Disagree politely"… */
  fn: string;
  topic: string;
  text: string;
  en: string;
  keys: string[];
  parts: [string, string][];
  swap: { role: string; options: string[] } | null;
}

export const PHRASE_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const BOOKS: Record<string, EssentialPhrase[]> = {
  es: (es as { phrases: EssentialPhrase[] }).phrases,
  fr: (fr as { phrases: EssentialPhrase[] }).phrases,
};

/** Every LinguaScript is prompted after this many newly saved words. */
export const BUILD_EVERY_N_SAVES = 5;

export function phrasesFor(language: string): EssentialPhrase[] {
  return BOOKS[String(language || '').toLowerCase()] || [];
}

const norm = (w: string) => String(w || '').toLowerCase().replace(/[’]/g, "'").trim();

/** True when the learner's words (normalised, any deck colour) cover every key. */
export function isUnlocked(phrase: EssentialPhrase, words: Set<string>): boolean {
  return phrase.keys.every((k) => k.split('|').some((form) => words.has(norm(form))));
}

/** Phrases unlocked by `words`, in teaching order (A1 first). */
export function unlockedPhrases(language: string, words: Iterable<string>): EssentialPhrase[] {
  const set = new Set([...words].map(norm));
  return phrasesFor(language).filter((p) => isUnlocked(p, set));
}

/** The phrases a newly saved word just unlocked (it must be one of the keys). */
export function newlyUnlocked(language: string, words: Iterable<string>, savedWord: string): EssentialPhrase[] {
  const w = norm(savedWord);
  return unlockedPhrases(language, words).filter((p) => p.keys.some((k) => k.split('|').map(norm).includes(w)));
}

/** The closest locked phrases: most keys already known, then easiest level. */
export function nextPhrases(language: string, words: Iterable<string>, n = 3): (EssentialPhrase & { missing: string[] })[] {
  const set = new Set([...words].map(norm));
  return phrasesFor(language)
    .filter((p) => !isUnlocked(p, set))
    .map((p) => ({ ...p, missing: p.keys.filter((k) => !k.split('|').some((f) => set.has(norm(f)))).map((k) => k.split('|')[0]) }))
    .sort((a, b) => a.missing.length - b.missing.length || PHRASE_LEVELS.indexOf(a.level) - PHRASE_LEVELS.indexOf(b.level))
    .slice(0, n);
}
