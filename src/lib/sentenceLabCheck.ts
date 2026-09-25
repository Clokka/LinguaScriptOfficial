// Sentence Lab, Step 3: answer checking.
//
// Every gap accepts more than one right answer — "j'ai besoin de ___" takes
// a verb (dormir) or a noun (aide) — so a drop is never just compared
// against one stored word. Checked cheapest-first:
//   1. Exact match.
//   2. Same word, wrong ending (désolé/désolée) — an accent/spelling nudge,
//      not a "wrong kind of word" hint.
//   3. Word type, via core_vocabulary.pos (+ the noun-or-infinitive
//      exception after a preposition, the one case the brief names).
//   4. Only when the type genuinely fits and it's still not the recorded
//      answer: ask the AI whether the *meaning* works, and cache that
//      answer forever (see check-word-fit) — the fit of a word in a frame
//      doesn't depend on who asked.
import { supabase } from "@/integrations/supabase/client";
import type { SentenceLabBoard } from "@/lib/sentenceLabBoard";

export type PosCategory = "verb" | "noun" | "adj" | "adv" | "other";

const POS_MAP: Record<string, PosCategory> = {
  v: "verb", verb: "verb", verbe: "verb",
  n: "noun", noun: "noun", nom: "noun",
  adj: "adj", adjective: "adj", adjectif: "adj",
  adv: "adv", adverb: "adv", adverbe: "adv",
};

export function posCategory(raw: string | null | undefined): PosCategory | null {
  if (!raw) return null;
  return POS_MAP[raw.trim().toLowerCase()] ?? null;
}

/** Prepositions French accepts either a noun or an infinitive after. Kept
 *  per-language and empty by default — an unlisted language just requires a
 *  same-category match instead of guessing at its grammar. */
const NOUN_OR_VERB_AFTER: Record<string, string[]> = {
  fr: ["de", "d'", "à", "pour", "sans", "avant de", "après"],
};

export function frameAcceptsNounOrVerb(language: string, frame: string): boolean {
  const lower = frame.trim().toLowerCase();
  return (NOUN_OR_VERB_AFTER[language] ?? []).some((p) => lower.endsWith(p));
}

const accentFold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface VocabRow {
  pos: string | null;
  translation: string | null;
}

async function lookupVocab(language: string, word: string): Promise<VocabRow | null> {
  const { data } = await supabase
    .from("core_vocabulary" as any)
    .select("pos, translation")
    .eq("language", language)
    .ilike("word", word)
    .limit(1)
    .maybeSingle();
  return (data as any) ?? null;
}

export interface CheckResult {
  correct: boolean;
  reason: "exact" | "type-fit" | "wrong-ending" | "wrong-type" | "wrong-meaning";
  hint?: string;
}

export async function checkAnswer(
  board: SentenceLabBoard,
  language: string,
  dropped: string,
): Promise<CheckResult> {
  if (dropped === board.answer) return { correct: true, reason: "exact" };

  if (accentFold(dropped) === accentFold(board.answer) && dropped.toLowerCase() !== board.answer.toLowerCase()) {
    return { correct: false, reason: "wrong-ending", hint: "So close! Check the ending." };
  }

  const [droppedVocab, answerVocab] = await Promise.all([
    lookupVocab(language, dropped),
    lookupVocab(language, board.answer),
  ]);
  const droppedCat = posCategory(droppedVocab?.pos);
  const answerCat = posCategory(answerVocab?.pos);

  const sameCategory = !!droppedCat && !!answerCat && droppedCat === answerCat;
  const nounVerbSwap =
    !!droppedCat && !!answerCat &&
    ((droppedCat === "noun" && answerCat === "verb") || (droppedCat === "verb" && answerCat === "noun")) &&
    frameAcceptsNounOrVerb(language, board.frame);

  // Missing POS data for either word: don't confidently reject — that would
  // risk telling a learner their genuinely-right answer is the wrong kind
  // of word. Fall through to the meaning check instead.
  const typeFits = sameCategory || nounVerbSwap || !droppedCat || !answerCat;

  if (!typeFits) {
    const wants =
      answerCat === "noun" || answerCat === "verb"
        ? "an action or a thing"
        : answerCat === "adj"
          ? "a describing word"
          : answerCat === "adv"
            ? "a word that describes how/when/where"
            : "a different kind of word";
    return {
      correct: false,
      reason: "wrong-type",
      hint: `This gap needs ${wants} (like "${board.answer}").`,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke("check-word-fit", {
      body: {
        patternId: board.patternId,
        language,
        frame: board.frame,
        after: board.after,
        translation: board.translation ?? "",
        candidate: dropped,
      },
    });
    if (!error && data?.fits) return { correct: true, reason: "type-fit" };
  } catch {
    // AI unreachable — fail closed to the honest meaning hint below rather
    // than silently accepting an unverified word.
  }

  let meaning = board.translation ?? "";
  if (meaning && answerVocab?.translation) {
    const withGap = meaning.replace(new RegExp(escapeRegExp(answerVocab.translation), "i"), "___");
    if (withGap !== meaning) meaning = withGap;
  }
  return {
    correct: false,
    reason: "wrong-meaning",
    hint: meaning
      ? `${board.frame} ___${board.after ? ` ${board.after}` : ""} = ${meaning}. Which one do you need?`
      : `Right kind of word — but not quite the right meaning here.`,
  };
}
