// LinguaScript's primary metric: "How green is the language?"
//
// Every visible token contributes a weight to a green-percentage score.
// Function words (articles, pronouns, prepositions, conjunctions) carry low
// weight; content words carry full weight. This stops "le / la / de" from
// inflating comprehension on every line.
import { normalizeToken, type SavedWordLite } from "@/lib/vocab";

const FUNCTION_WORDS: Record<string, Set<string>> = {
  fr: new Set([
    "le","la","les","l","un","une","des","de","du","d","au","aux","à","a",
    "et","ou","mais","donc","or","ni","car","que","qu","qui","quoi","dont","où",
    "je","tu","il","elle","on","nous","vous","ils","elles","me","te","se","lui","leur","y","en",
    "ce","cet","cette","ces","mon","ma","mes","ton","ta","tes","son","sa","ses","notre","nos","votre","vos","leur","leurs",
    "est","sont","était","être","ai","as","avoir","ont","pas","ne","n","si","oui","non","plus","moins","très","bien",
    "pour","par","sur","sous","dans","avec","sans","entre","vers","chez","comme","aussi","alors","puis"
  ]),
  es: new Set([
    "el","la","los","las","un","una","unos","unas","de","del","al","a","y","o","u","pero","que","si","no","sí",
    "yo","tú","él","ella","usted","nosotros","vosotros","ellos","ellas","me","te","se","lo","le","nos","os","les",
    "mi","tu","su","nuestro","vuestro","mis","tus","sus","es","son","era","ser","ha","han","hay","muy","más","menos",
    "para","por","con","sin","en","entre","sobre","bajo","desde","hasta","como","también","ya","todavía"
  ]),
  de: new Set([
    "der","die","das","den","dem","des","ein","eine","einen","einem","einer","eines","und","oder","aber","doch",
    "ich","du","er","sie","es","wir","ihr","mich","dich","sich","uns","euch","ihm","ihn","ihnen","mein","dein","sein","ihr","unser",
    "ist","sind","war","waren","sein","habe","hat","haben","nicht","kein","keine","ja","nein","sehr","mehr","auch",
    "für","von","mit","ohne","auf","unter","über","zu","zur","zum","in","im","ans","aus","bei","nach","seit","wie","als","dass"
  ]),
  it: new Set([
    "il","lo","la","i","gli","le","un","uno","una","di","del","della","dei","degli","delle","a","al","alla","ai","agli","alle",
    "e","o","ma","se","che","chi","cui","io","tu","lui","lei","noi","voi","loro","mi","ti","si","ci","vi","gli","le",
    "è","sono","era","essere","ho","ha","abbiamo","hanno","non","sì","no","molto","più","meno","anche","già",
    "per","con","senza","su","sotto","tra","fra","da","in","come","quando"
  ]),
  pt: new Set([
    "o","a","os","as","um","uma","uns","umas","de","do","da","dos","das","no","na","nos","nas","e","ou","mas","que","se",
    "eu","tu","você","ele","ela","nós","vós","eles","elas","me","te","se","lhe","nos","vos","lhes",
    "é","são","era","ser","tenho","tem","têm","não","sim","muito","mais","menos","também","já",
    "para","por","com","sem","em","entre","sobre","sob","como","quando"
  ]),
  en: new Set([
    "the","a","an","of","to","in","on","at","by","for","with","from","as","is","are","was","were","be","been","being",
    "and","or","but","if","then","than","so","because","while","that","this","these","those","it","its","i","you","he","she","we","they","me","him","her","us","them","my","your","his","our","their"
  ]),
};

// Re-export so callers don't need a second import.
export { normalizeToken };

/** Lower weight for function/grammatical words, full weight for content words. */
export function tokenWeight(token: string, language: string): number {
  const set = FUNCTION_WORDS[(language || "").toLowerCase()];
  if (!set) return 1;
  return set.has(token) ? 0.25 : 1;
}

/** Split a subtitle line into normalised tokens (drops punctuation/empties). */
export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => normalizeToken(t))
    .filter((t) => t.length > 0 && /[\p{L}]/u.test(t));
}

export interface GreenScore {
  pct: number;          // 0–100, weighted
  knownWeight: number;
  totalWeight: number;
  knownCount: number;
  totalCount: number;
}

export function greenScoreForLine(
  text: string,
  language: string,
  deck: Map<string, SavedWordLite>,
): GreenScore {
  const tokens = tokenize(text);
  let knownW = 0;
  let totalW = 0;
  let knownC = 0;
  for (const t of tokens) {
    const w = tokenWeight(t, language);
    totalW += w;
    const state = deck.get(t)?.state;
    if (state === "green") {
      knownW += w;
      knownC += 1;
    }
  }
  const pct = totalW > 0 ? Math.round((knownW / totalW) * 100) : 0;
  return { pct, knownWeight: knownW, totalWeight: totalW, knownCount: knownC, totalCount: tokens.length };
}

/**
 * Coarse estimate of overall language understanding for the homepage hero.
 * Compares the user's green-word count against a conservative "active
 * vocabulary ceiling" for a fluent reader (~5000 lemmas). Capped at 99% —
 * LinguaScript never claims a learner is fully done.
 */
export function estimateLanguageUnderstanding(greenCount: number): number {
  const ceiling = 5000;
  const pct = Math.round((greenCount / ceiling) * 100);
  return Math.max(0, Math.min(99, pct));
}

/** Bucket a video's comprehension % into a learning zone label. */
export type LearningZone = "too-easy" | "ideal" | "stretch" | "too-hard";
export function learningZone(pct: number): LearningZone {
  if (pct >= 96) return "too-easy";
  if (pct >= 85) return "ideal";
  if (pct >= 70) return "stretch";
  return "too-hard";
}
