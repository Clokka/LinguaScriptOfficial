// Free, key-less backup translator (Google Translate's public "gtx" web
// endpoint). Used when the Lovable AI gateway is out of credits (402) or
// rate-limited (429), so word taps and subtitle translation keep working
// instead of hanging on "Translating…". No lemma/grammar info — just meaning.

const NAME_TO_CODE: Record<string, string> = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it',
  portuguese: 'pt', chinese: 'zh-CN', mandarin: 'zh-CN', japanese: 'ja',
  korean: 'ko', arabic: 'ar', hindi: 'hi', thai: 'th', russian: 'ru',
  turkish: 'tr', dutch: 'nl', polish: 'pl', swedish: 'sv',
};

/** Accepts a language label ("French") or a code ("fr") and returns a Google code. */
export function toLangCode(lang: string): string {
  const raw = String(lang || '').trim();
  const byName = NAME_TO_CODE[raw.toLowerCase()];
  if (byName) return byName;
  if (/^zh/i.test(raw)) return 'zh-CN';
  return raw.toLowerCase() || 'auto';
}

export interface FreeTranslation { text: string; romanization: string }

export async function freeTranslate(text: string, from: string, to: string): Promise<FreeTranslation> {
  const body = new URLSearchParams({ q: text });
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=rm&sl=${encodeURIComponent(toLangCode(from))}&tl=${encodeURIComponent(toLangCode(to))}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Free translator failed: ${res.status}`);
  const data = await res.json();
  const parts: any[] = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = parts.map((p) => (typeof p?.[0] === 'string' ? p[0] : '')).join('');
  // The romanization row (pinyin, romaji…) has no translated text and the
  // source transliteration at index 3.
  const romanization = parts.map((p) => (p?.[0] == null && typeof p?.[3] === 'string' ? p[3] : '')).join('').trim();
  return { text: translated.trim(), romanization };
}

/** Translates many lines, keeping their order. Batches to stay under request limits. */
export async function freeTranslateLines(lines: string[], from: string, to: string): Promise<string[]> {
  const out: string[] = new Array(lines.length).fill('');
  const MAX_CHARS = 4000;
  let start = 0;
  while (start < lines.length) {
    let end = start;
    let size = 0;
    while (end < lines.length && (end === start || size + lines[end].length + 1 <= MAX_CHARS)) {
      size += lines[end].length + 1;
      end++;
    }
    const batch = lines.slice(start, end).map((l) => l.replace(/\n/g, ' '));
    const { text } = await freeTranslate(batch.join('\n'), from, to);
    const translated = text.split('\n');
    if (translated.length === batch.length) {
      translated.forEach((t, i) => { out[start + i] = t.trim(); });
    } else {
      // Line breaks didn't survive — translate this batch one line at a time.
      for (let i = 0; i < batch.length; i++) {
        try { out[start + i] = (await freeTranslate(batch[i], from, to)).text; } catch { /* leave blank */ }
      }
    }
    start = end;
  }
  return out;
}
