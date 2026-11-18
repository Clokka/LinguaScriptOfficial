// Export a learner's saved words to Anki (CSV with Anki file headers) or
// Quizlet (term<TAB>definition per line, Quizlet's default import format).
// Pure functions, shared by the website and future apps.
import { getLanguageLabel } from "./languages";
import { displayState, isBlue, type ReviewFields } from "./review";

export interface ExportWord extends ReviewFields {
  id: string;
  word: string;
  translation: string | null;
  language: string;
  context?: string | null;
  context_translation?: string | null;
}

/** The colour a word has right now: red / orange / green / gold / blue. */
export const exportColour = (w: ExportWord): string => (isBlue(w) ? "blue" : displayState(w));

const html = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
const flat = (s: string | null | undefined) => String(s ?? "").replace(/[\t\r\n]+/g, " ").trim();

/**
 * Anki CSV. Front = word, Back = meaning + the sentence it was saved from.
 * The GUID column makes a re-import UPDATE the same notes instead of duplicating;
 * the Deck column puts each language in "LinguaScript::<Language>".
 */
export function toAnkiCsv(words: ExportWord[]): string {
  const lines = [
    "#separator:comma",
    "#html:true",
    "#columns:Front,Back,Colour,Tags,Deck,GUID",
    "#tags column:4",
    "#deck column:5",
    "#guid column:6",
  ];
  for (const w of words) {
    const colour = exportColour(w);
    const sentence = flat(w.context);
    const back = [html(flat(w.translation)), sentence ? `<br><br><i>${html(sentence)}</i>` : "", sentence && w.context_translation ? `<br>${html(flat(w.context_translation))}` : ""].join("");
    lines.push([
      cell(html(flat(w.word))), cell(back), colour,
      cell(`linguascript linguascript::${colour}`),
      cell(`LinguaScript::${getLanguageLabel(w.language)}`),
      cell(`linguascript-${w.id}`),
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

/** Quizlet import text: one card per line, Tab between the word and its meaning. */
export function toQuizletText(words: ExportWord[]): string {
  return words.filter((w) => flat(w.word)).map((w) => `${flat(w.word)}\t${flat(w.translation)}`).join("\n");
}
