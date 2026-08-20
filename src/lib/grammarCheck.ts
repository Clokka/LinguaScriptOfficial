import { supabase } from "@/integrations/supabase/client";

export interface GrammarMatch {
  offset: number;
  length: number;
  message: string;
  shortMessage: string;
}

export interface GrammarCheckResult {
  /** False when the check itself failed (network, edge function down, ...). */
  ok: boolean;
  /** False when LanguageTool doesn't cover this language — matches is always empty then. */
  supported: boolean;
  matches: GrammarMatch[];
}

/** Grade a built sentence with LanguageTool, via the check-grammar edge function. */
export async function checkGrammar(text: string, language: string): Promise<GrammarCheckResult> {
  try {
    const { data, error } = await supabase.functions.invoke("check-grammar", {
      body: { text, language },
    });
    if (error) throw error;
    return {
      ok: data?.ok !== false,
      supported: data?.supported !== false,
      matches: Array.isArray(data?.matches) ? data.matches : [],
    };
  } catch (err) {
    console.error("[grammarCheck] failed:", err);
    return { ok: false, supported: false, matches: [] };
  }
}

/**
 * Word-by-word fallback for when LanguageTool can't grade this language (or
 * the request failed): the first word that doesn't match the known-correct
 * sentence, returned as a match so it underlines exactly like a real
 * LanguageTool result would.
 */
export function positionalMismatch(built: string, target: string): GrammarMatch[] {
  const builtWords = built.trim().split(/\s+/).filter(Boolean);
  const targetWords = target.trim().split(/\s+/).filter(Boolean);

  let offset = 0;
  for (let i = 0; i < builtWords.length; i++) {
    const word = builtWords[i];
    if (word !== targetWords[i]) {
      return [{ offset, length: word.length, message: "Not quite the right word here.", shortMessage: "Wrong word" }];
    }
    offset += word.length + 1; // +1 for the joining space
  }

  if (builtWords.length !== targetWords.length) {
    const last = builtWords[builtWords.length - 1] ?? "";
    return [{
      offset: Math.max(0, built.length - last.length),
      length: last.length,
      message: "The sentence is incomplete.",
      shortMessage: "Incomplete",
    }];
  }

  return [];
}

export interface TextSegment {
  text: string;
  underline: boolean;
}

/** Split `text` into segments so the caller can underline exactly the matched ranges. */
export function splitByMatches(text: string, matches: GrammarMatch[]): TextSegment[] {
  if (!matches.length) return [{ text, underline: false }];

  const ranges = matches
    .map((m) => ({ start: Math.max(0, m.offset), end: Math.min(text.length, m.offset + m.length) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue; // overlapping match — keep the first
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start), underline: false });
    segments.push({ text: text.slice(r.start, r.end), underline: true });
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), underline: false });

  return segments;
}
