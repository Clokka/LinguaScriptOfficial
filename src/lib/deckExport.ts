/**
 * Send LinguaScript words to Anki or Quizlet.
 *
 * Anki: a plain-text file with Anki's import headers (File → Import opens it
 * with the right columns, no setup). Quizlet has no public API for making sets
 * any more, so "Save to Quizlet" copies "word<TAB>meaning" lines and opens
 * Quizlet's create page, where the learner pastes into "Import". Both stay on
 * the learner's device — nothing is uploaded by us.
 */
import { track } from "@/lib/analytics";

export interface ExportCard {
  word: string;
  meaning: string;
  example?: string;
}

const clean = (s: string | undefined) => (s ?? "").replace(/[\t\r\n]+/g, " ").trim();

/** "word<TAB>meaning" lines — the format both Anki and Quizlet import. */
export function toTabLines(cards: ExportCard[]): string {
  return cards
    .filter((c) => clean(c.word))
    .map((c) => `${clean(c.word)}\t${clean(c.meaning)}${c.example ? `\t${clean(c.example)}` : ""}`)
    .join("\n");
}

export function ankiFile(cards: ExportCard[], deckName: string): string {
  const hasExample = cards.some((c) => clean(c.example));
  return [
    "#separator:tab",
    "#html:false",
    `#deck:${clean(deckName)}`,
    `#columns:Front\tBack${hasExample ? "\tExample" : ""}`,
    "#tags:LinguaScript",
    toTabLines(cards),
  ].join("\n");
}

export function downloadAnki(cards: ExportCard[], deckName: string) {
  const blob = new Blob([ankiFile(cards, deckName)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${deckName.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "LinguaScript"}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  track("deck_exported", { to: "anki", words: cards.length });
}

export const QUIZLET_CREATE_URL = "https://quizlet.com/create-set";

/** Copies the words for Quizlet's Import box. Returns false if the clipboard is blocked. */
export async function copyForQuizlet(cards: ExportCard[]): Promise<boolean> {
  const text = cards.map((c) => `${clean(c.word)}\t${clean(c.meaning)}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    track("deck_exported", { to: "quizlet", words: cards.length });
    return true;
  } catch {
    return false;
  }
}
