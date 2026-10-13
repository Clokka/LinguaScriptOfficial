// Languages written without spaces between words. Subtitle code splits lines
// on spaces, so without this a whole Chinese line ("我是佳佳") is one tappable
// "word": pre-taught words inside it never get a ring and can't be saved alone.
const UNSPACED = new Set(["zh", "ja", "th", "lo", "km", "my"]);

/**
 * Puts a space between the words of an unspaced-language line, with
 * punctuation as its own piece: "你好，我是佳佳。" → "你好 ， 我 是 佳佳 。".
 * Uses the browser's word segmenter (the same one pre-teach grades with), so
 * a ring word like 在 lines up with a subtitle word. Other languages, or a
 * browser without Intl.Segmenter, get the text back unchanged.
 */
export function spaceOutWords(text: string, lang: string | null | undefined): string {
  const base = (lang || "").toLowerCase().split("-")[0];
  const Seg = (Intl as any).Segmenter;
  if (!UNSPACED.has(base) || !Seg || !text) return text;
  try {
    const seg = new Seg(base, { granularity: "word" });
    return Array.from(seg.segment(text) as Iterable<{ segment: string }>)
      .map((s) => s.segment.trim())
      .filter(Boolean)
      .join(" ");
  } catch {
    return text;
  }
}
