export interface SrtEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

function timeToSeconds(time: string): number {
  const [hours, minutes, rest] = time.split(":");
  const [seconds, millis] = rest.split(",");
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseInt(seconds) +
    parseInt(millis) / 1000
  );
}

export function parseSrt(content: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  // Normalize line endings
  const blocks = content.replace(/\r\n/g, "\n").trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    if (isNaN(index)) continue;

    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = timeToSeconds(timeMatch[1]);
    const endTime = timeToSeconds(timeMatch[2]);
    const text = lines.slice(2).join(" ").trim();

    entries.push({ index, startTime, endTime, text });
  }

  return entries.sort((a, b) => a.startTime - b.startTime);
}
