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

export type VerbForm = "infinitive" | "gerund" | "participle" | "conjugated";

const FORM_LABEL: Record<VerbForm, string> = {
  infinitive: "infinitive",
  gerund: "-ing form",
  participle: "past-participle form",
  conjugated: "conjugated form",
};

// Spanish/French attach an object/reflexive pronoun straight onto an
// infinitive or gerund ("ayudarme", "dándole") — strip it before reading the
// verb's own ending, longest cluster first so "selo" doesn't get read as "lo".
const CLITICS = [
  "selo", "sela", "selos", "selas",
  "melo", "mela", "melos", "melas",
  "telo", "tela", "telos", "telas",
  "noslo", "nosla",
  "nos", "os", "me", "te", "se", "lo", "la", "le", "los", "las", "les",
].sort((a, b) => b.length - a.length);

function stripClitics(word: string): string {
  for (const c of CLITICS) {
    if (word.length > c.length + 2 && word.endsWith(c)) {
      const stem = word.slice(0, word.length - c.length);
      // Only strip when what's left is itself a plausible infinitive/gerund —
      // otherwise a conjugated form that happens to end in "te"/"se"/"le"/...
      // ("intentaste") gets its real ending eaten and misread as something
      // else ("intentas").
      if (/(ar|er|ir|ando|iendo|yendo)$/.test(stem)) return stem;
    }
  }
  return word;
}

/**
 * Classifies a word's verb form by surface suffix — a rule-based stand-in
 * for morphology data the app doesn't have. Deliberately conservative: an
 * unrecognized shape returns null rather than a guess, so it only ever
 * blocks an answer when it's confident the shapes genuinely differ (see
 * how it's used below — both sides must resolve before it can reject).
 */
export function verbFormFamily(word: string, language: string): VerbForm | null {
  const w = stripClitics(word.trim().toLowerCase());
  if (!w) return null;

  if (language === "es") {
    if (/(ando|iendo|yendo)$/.test(w)) return "gerund";
    if (/(ar|er|ir)$/.test(w)) return "infinitive";
    if (/(ado|ada|ados|adas|ido|ida|idos|idas)$/.test(w)) return "participle";
    if (/(aste|amos|aron|ó|é|imos|iste|ieron|aba|abas|ábamos|aban|ía|ías|íamos|ían)$/.test(w)) return "conjugated";
    return null;
  }
  if (language === "fr") {
    if (/ant$/.test(w)) return "gerund";
    if (/(er|ir|re|oir)$/.test(w)) return "infinitive";
    if (/(é|ée|és|ées|i|ie|is|u|ue|us)$/.test(w)) return "participle";
    return null; // French conjugated endings are too varied to heuristic safely
  }
  return null;
}

const accentFold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

interface VocabRow {
  pos: string | null;
}

async function lookupVocab(language: string, word: string): Promise<VocabRow | null> {
  const { data } = await supabase
    .from("core_vocabulary" as any)
    .select("pos")
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

  // The broad category (verb/noun/...) fits, but a verb slot can still want
  // a specific FORM — the infinitive after a modal, not a gerund or a
  // conjugated form. Skipped whenever either side is a confirmed noun (the
  // noun/verb swap case above): a noun's suffix can coincidentally look
  // verb-shaped ("lugar" ends like an infinitive) and must never be
  // second-guessed once the swap rule has already accepted it.
  const answerForm = verbFormFamily(board.answer, language);
  const droppedForm = verbFormFamily(dropped, language);
  const eitherConfirmedNoun = droppedCat === "noun" || answerCat === "noun";
  const verbShaped = !eitherConfirmedNoun && (answerCat === "verb" || droppedCat === "verb" || (!!answerForm && !!droppedForm));
  if (verbShaped && answerForm && droppedForm && answerForm !== droppedForm) {
    return {
      correct: false,
      reason: "wrong-type",
      hint: `This needs the ${FORM_LABEL[answerForm]} (like "${board.answer}"), not the ${FORM_LABEL[droppedForm]}.`,
    };
  }

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
