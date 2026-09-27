// Word-form dictionary client: surface form -> lemma + exact grammatical form.
// Backed by public.word_forms (UniMorph imports + stored AI analyses). Words
// the dictionary hasn't seen are analysed once by analyze-word-form and kept.
import { supabase } from "@/integrations/supabase/client";
import { normalizeToken } from "@/lib/vocab";
import type { SlotAccepts } from "@/lib/sentencePatterns";

export interface WordForm {
  surface: string;
  lemma: string;
  pos: string;
  form: SlotAccepts["form"];
  person: string | null;
  number: string | null;
  tense: string | null;
  mood: string | null;
}

const COLS = "surface, lemma, pos, form, person, number, tense, mood";

export async function loadWordForms(language: string, words: string[]): Promise<Map<string, WordForm>> {
  const surfaces = [...new Set(words.map((w) => normalizeToken(w)).filter(Boolean))];
  const out = new Map<string, WordForm>();
  for (let i = 0; i < surfaces.length; i += 300) {
    const { data } = await supabase
      .from("word_forms" as any)
      .select(COLS)
      .eq("language", language)
      .in("surface", surfaces.slice(i, i + 300));
    for (const r of (data as any[]) ?? []) out.set(r.surface, r as WordForm);
  }
  const missing = surfaces.filter((s) => !out.has(s)).slice(0, 60);
  if (missing.length) {
    try {
      const { data } = await supabase.functions.invoke("analyze-word-form", { body: { language, words: missing } });
      for (const r of (data?.forms as any[]) ?? []) out.set(r.surface, r as WordForm);
    } catch {
      // Unanalysed words simply stay off the board this session.
    }
  }
  return out;
}

export const FORM_LABEL: Record<NonNullable<SlotAccepts["form"]>, string> = {
  infinitive: "infinitive",
  gerund: "-ing form",
  participle: "past participle",
  conjugated: "conjugated form",
};

const POS_LABEL: Record<string, string> = {
  verb: "an action word (verb)",
  noun: "a thing (noun)",
  adj: "a describing word",
  adv: "a word that says how, when or where",
};

const TENSE_LABEL: Record<string, string> = {
  present: "present", past: "past", imperfect: "imperfect", future: "future", conditional: "conditional",
};

/** Does this word's analysis satisfy the gap? Returns an exact hint if not. */
export function fitsAccepts(
  f: WordForm,
  a: SlotAccepts,
  frameAcceptsNounOrVerb = false,
): { ok: boolean; hint?: string } {
  const posOk =
    f.pos === a.pos ||
    (frameAcceptsNounOrVerb && ((f.pos === "noun" && a.pos === "verb" && a.form === "infinitive") || (f.pos === "verb" && f.form === "infinitive" && a.pos === "noun")));
  if (!posOk) return { ok: false, hint: `This gap needs ${POS_LABEL[a.pos] ?? "a different kind of word"}.` };
  if (f.pos !== "verb" || a.pos !== "verb" || !a.form) return { ok: true };
  if (f.form !== a.form) {
    const want = a.form === "conjugated" && a.tense ? `${TENSE_LABEL[a.tense] ?? a.tense} form` : FORM_LABEL[a.form];
    const got = f.form ? FORM_LABEL[f.form] : "a different form";
    return { ok: false, hint: `This needs the ${want}${f.lemma ? ` (of ${f.lemma})` : ""}, not the ${got}.` };
  }
  if (a.form === "conjugated") {
    if (a.tense && f.tense && a.tense !== f.tense) {
      return { ok: false, hint: `Right verb form, wrong tense — this needs the ${TENSE_LABEL[a.tense] ?? a.tense}.` };
    }
    if (a.person && f.person && (a.person !== f.person || (a.number && f.number && a.number !== f.number))) {
      return { ok: false, hint: `Check who is doing it — the ending doesn't match the subject.` };
    }
  }
  return { ok: true };
}
