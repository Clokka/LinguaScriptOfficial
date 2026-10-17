// Tiny SRT reader/writer for the Stremio addon. No Deno-only APIs, so it can
// be unit-tested with bun/node as well.

export interface Cue {
  start: string; // "00:01:02,345"
  end: string;
  text: string; // original lines, joined with "\n"
}

const TIME = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/;

const normTime = (t: string) => {
  const [hms, ms] = t.replace('.', ',').split(',');
  const [h, m, s] = hms.split(':');
  return `${h.padStart(2, '0')}:${m}:${s},${ms.padEnd(3, '0').slice(0, 3)}`;
};

export function parseSrt(raw: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const timeIdx = lines.findIndex((l) => TIME.test(l));
    if (timeIdx === -1) continue;
    const [, start, end] = lines[timeIdx].match(TIME)!;
    const text = lines.slice(timeIdx + 1).join('\n').trim();
    if (!text) continue;
    cues.push({ start: normTime(start), end: normTime(end), text });
  }
  return cues;
}

/** Strips SRT/ASS styling so the text can be sent to a translator. */
export function plainText(text: string): string {
  return text
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

/** Learning-language line on top, the translation underneath in italics. */
export function buildDualSrt(cues: Cue[], translations: string[]): string {
  return cues
    .map((c, i) => {
      // Drop the source's own styling so only the translation is italic.
      const original = c.text.replace(/\{\\[^}]*\}/g, '').replace(/<[^>]+>/g, '');
      const tr = (translations[i] || '').trim();
      const body = tr ? `${original}\n<i>${tr}</i>` : original;
      return `${i + 1}\n${c.start} --> ${c.end}\n${body}`;
    })
    .join('\n\n') + '\n';
}

/** Reads subtitle bytes as UTF-8, falling back to Windows-1252 for old files. */
export function decodeSubtitle(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
