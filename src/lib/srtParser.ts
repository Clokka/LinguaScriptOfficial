export interface SrtEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

// Accepts "00:01:02,345", "0:01:02.345", "01:02.345" (VTT) and missing millis.
const TIME = String.raw`(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[,.](\d{1,3}))?`;
const TIME_LINE = new RegExp(`${TIME}\\s*-->\\s*${TIME}`);

function toSeconds(h: string | undefined, m: string, s: string, ms: string | undefined): number {
  return (
    parseInt(h || "0") * 3600 +
    parseInt(m) * 60 +
    parseInt(s) +
    (ms ? parseInt(ms.padEnd(3, "0")) / 1000 : 0)
  );
}

/**
 * Parses SRT (and WebVTT) subtitle files, including DownSub downloads, which
 * may start with a byte-order mark, use "." in timestamps or omit cue numbers.
 */
export function parseSrt(content: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  const blocks = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const timeIdx = lines.findIndex((l) => TIME_LINE.test(l));
    if (timeIdx === -1) continue;

    const m = lines[timeIdx].match(TIME_LINE)!;
    const startTime = toSeconds(m[1], m[2], m[3], m[4]);
    const endTime = toSeconds(m[5], m[6], m[7], m[8]);
    const text = lines
      .slice(timeIdx + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const index = timeIdx > 0 ? parseInt(lines[timeIdx - 1]) : NaN;
    entries.push({ index: isNaN(index) ? entries.length + 1 : index, startTime, endTime, text });
  }

  return entries.sort((a, b) => a.startTime - b.startTime);
}
