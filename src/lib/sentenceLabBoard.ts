// Sentence Lab board building.
//
// A board is one sentence FRAME with a single gap, filled from the learner's
// own known vocabulary — never an AI-invented word. Real data decides:
//   - the frame + correct filler come from a real sentence_patterns row
//     (template + a worked example), not a generated sentence.
//   - every candidate block is a word the learner has actually saved.
//
// core_phrases (the brief's primary frame source, kind='frame') doesn't exist
// in the schema yet, so this runs entirely on the sentence_patterns fallback.
// Swapping in core_phrases later only changes loadFrameCandidates(); the rest
// of the pipeline (extraction, candidate building, session assembly) is
// already shaped around "frame text + one gap + a real filler word".
import { normalizeToken, type SavedWordLite } from "@/lib/vocab";
import { loadPatterns, orderPatternsForSession, recentlyUsedPatternIds, type SentencePattern } from "@/lib/sentencePatterns";

export interface SentenceLabBoard {
  patternId: string;
  /** Text before the gap — a chunk if it's more than one word, e.g. "J'ai besoin de". */
  frame: string;
  /** Text after the gap, usually empty. */
  after: string;
  /** The correct filler — always a word from the learner's own saved deck. */
  answer: string;
  answerSkin: "green" | "orange";
  /** 3–5 draggable blocks, answer included, order randomised. */
  candidates: { word: string; skin: "green" | "orange" }[];
}

/** Splits "J'ai besoin de ___" into { before: "J'ai besoin de", after: "" }.
 *  Returns null for anything but exactly one gap — multi-blank templates
 *  ("Si ___, je ___") aren't a single-gap board and are skipped for now. */
function splitSingleBlank(template: string): { before: string; after: string } | null {
  const parts = template.split("___");
  if (parts.length !== 2) return null;
  return { before: parts[0].trim(), after: parts[1].trim() };
}

/**
 * Recovers the word the template's blank stands for by stripping the
 * template's own fixed text off the front and back of its worked example.
 * "J'ai besoin de ___" + "J'ai besoin de dormir." → "dormir".
 */
function extractFiller(before: string, after: string, example: string): string | null {
  const norm = (s: string) => s.trim().replace(/[.!?]+$/, "");
  let rest = norm(example);
  const beforeNorm = norm(before);
  if (beforeNorm && rest.toLowerCase().startsWith(beforeNorm.toLowerCase())) {
    rest = rest.slice(beforeNorm.length).trim();
  } else {
    return null; // example doesn't actually match this template — skip it
  }
  const afterNorm = norm(after);
  if (afterNorm) {
    if (!rest.toLowerCase().endsWith(afterNorm.toLowerCase())) return null;
    rest = rest.slice(0, rest.length - afterNorm.length).trim();
  }
  return rest || null;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Builds up to `count` boards for a session. Only patterns whose extracted
 * filler is a single word the learner has actually saved (green, or orange
 * as a stretch) become boards — nothing here invents vocabulary.
 */
export function buildSession(
  patterns: SentencePattern[],
  deck: Map<string, SavedWordLite>,
  count = 5,
): SentenceLabBoard[] {
  const green = [...deck.values()].filter((w) => w.state === "green");
  const orange = [...deck.values()].filter((w) => w.state === "orange");
  const greenWords = green.map((w) => w.word);
  const orangeWords = orange.map((w) => w.word);

  const boards: SentenceLabBoard[] = [];
  for (const pattern of patterns) {
    if (boards.length >= count) break;
    const split = splitSingleBlank(pattern.template);
    if (!split || !pattern.example) continue;
    const filler = extractFiller(split.before, split.after, pattern.example);
    if (!filler) continue;

    // Single word only — a board fills one block, not a saved phrase.
    const tokens = filler.split(/\s+/).filter(Boolean);
    if (tokens.length !== 1) continue;
    const key = normalizeToken(tokens[0]);
    if (!key) continue;

    const entry = deck.get(key);
    if (!entry || (entry.state !== "green" && entry.state !== "orange")) continue;
    const answerSkin = entry.state;

    // 2–4 distractors from the learner's own green words, plus at most one
    // orange word thrown in — never a word invented for the occasion.
    const otherGreen = shuffle(greenWords.filter((w) => normalizeToken(w) !== key));
    const distractorCount = Math.min(3, Math.max(2, otherGreen.length >= 2 ? 3 : otherGreen.length));
    const distractors: { word: string; skin: "green" | "orange" }[] =
      otherGreen.slice(0, distractorCount).map((word) => ({ word, skin: "green" }));

    if (answerSkin === "green" && orangeWords.length > 0 && distractors.length < 4) {
      const orangePick = shuffle(orangeWords.filter((w) => normalizeToken(w) !== key))[0];
      if (orangePick) distractors.push({ word: orangePick, skin: "orange" });
    }

    const candidates = shuffle([{ word: tokens[0], skin: answerSkin }, ...distractors]);
    if (candidates.length < 3) continue; // not enough real vocabulary yet for a fair board

    boards.push({
      patternId: pattern.id,
      frame: split.before,
      after: split.after,
      answer: tokens[0],
      answerSkin,
      candidates,
    });
  }
  return boards;
}

/** Loads and assembles today's session in one call. */
export async function loadSession(
  userId: string,
  language: string,
  cefLevel: string,
  deck: Map<string, SavedWordLite>,
  count = 5,
): Promise<SentenceLabBoard[]> {
  const [patterns, recent] = await Promise.all([
    loadPatterns(language, cefLevel),
    recentlyUsedPatternIds(userId, language),
  ]);
  const ordered = orderPatternsForSession(patterns, recent);
  return buildSession(ordered, deck, count);
}
