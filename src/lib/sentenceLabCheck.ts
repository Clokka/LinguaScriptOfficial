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
//   4. Verb FORM, via suffix heuristics (verbFormFamily) — POS alone can't
//      tell "ayudarme" (infinitive) from "matando" (gerund) from "intentaste"
//      (conjugated past); they're all just "verb". This also covers words
//      core_vocabulary has no row for at all — saved_words holds real
//      inflected forms a learner saved from a video, while core_vocabulary
//      keys one row per LEMMA, so a conjugated/gerund form frequently has no
//      POS row to look up in the first place. Without this step that missing
//      data fell through as "don't reject", so a gerund could stand in for
//      an infinitive and only ever get told its *meaning* was off.
//   5. Only when the type AND form genuinely fit and it's still not the
//      recorded answer: ask the AI whether the *meaning* works, and cache
//      that answer forever (see check-word-fit) — the fit of a word in a
//      frame doesn't depend on who asked.
import { supabase } from "@/integrations/supabase/client";
import type { SentenceLabBoard } from "@/lib/sentenceLabBoard";
import { loadWordForms, fitsAccepts } from "@/lib/wordForms";
import { normalizeToken } from "@/lib/vocab";

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

  // Exact grammar check from the word_forms dictionary against what the
  // frame declares it accepts — no suffix guessing, irregular forms included.
  const forms = await loadWordForms(language, [dropped, board.answer]);
  const droppedForm = forms.get(normalizeToken(dropped));
  const accepts = board.accepts;
  if (!droppedForm || !accepts) {
    return { correct: false, reason: "wrong-meaning", hint: `Not this one — try another word.` };
  }
  const fit = fitsAccepts(droppedForm, accepts, frameAcceptsNounOrVerb(language, board.frame));
  if (!fit.ok) return { correct: false, reason: "wrong-type", hint: fit.hint };

  try {
    const { data, error } = await supabase.functions.invoke("check-word-fit", {
      body: {
        patternId: board.patternId,
        language,
        frame: board.frame,
        after: board.after,
        candidate: dropped,
      },
    });
    if (!error && data?.fits) return { correct: true, reason: "type-fit" };
  } catch {
    // AI unreachable — fail closed to the honest meaning hint below rather
    // than silently accepting an unverified word.
  }

  return {
    correct: false,
    reason: "wrong-meaning",
    hint: `Right kind of word — but not quite the right meaning here.`,
  };
}
