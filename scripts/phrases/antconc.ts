#!/usr/bin/env -S npx tsx
/**
 * LinguaScript's built-in AntConc: find the chunks and phrase-frames that are
 * common in real speech, from any pile of subtitles or transcripts.
 *
 * Every file (or every video) is one document, so each result carries RANGE —
 * how many different videos it appears in — alongside raw frequency. A chunk
 * that shows up in 40 videos is teachable; one that one character repeats 40
 * times in one film is not.
 *
 * Sources (pick one):
 *   --dir PATH          .srt / .vtt / .txt files (e.g. ORFEO or CFPP2000
 *                       transcripts you've downloaded, or exported subtitles)
 *   --supabase LANG     every film in LinguaScript's database for that language
 *                       (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or the
 *                       public anon key — subtitles are publicly readable)
 *
 * Options:
 *   --out PREFIX        output prefix (default data/<lang|corpus>/antconc)
 *   --lemmas FILE       word->lemma TSV, adds a lemma_key column
 *   --min-n 2 --max-n 5 --min-freq 3 --min-range 2
 *
 * Writes PREFIX-ngrams.csv and PREFIX-frames.csv.
 *
 * Example:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/phrases/antconc.ts --supabase fr --lemmas data/fr/fr-lemmas.tsv
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { countNgrams, extractFrames, lemmaKey, tokenize } from "../../src/lib/phraseFrames";

const argv = process.argv.slice(2);
const flag = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback);

/** Subtitle files -> plain lines of speech (drops cue numbers and timestamps). */
function subtitleLines(raw: string): string[] {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "WEBVTT" && !/^\d+$/.test(l) && !/-->/.test(l) && !/^(NOTE|STYLE)\b/.test(l));
}

function fromDir(dir: string): string[][][] {
  const docs: string[][][] = [];
  for (const file of readdirSync(dir)) {
    if (![".srt", ".vtt", ".txt"].includes(extname(file).toLowerCase())) continue;
    const lines = subtitleLines(readFileSync(join(dir, file), "utf8"));
    docs.push(lines.map(tokenize).filter((l) => l.length > 0));
  }
  return docs;
}

async function fromSupabase(lang: string): Promise<string[][][]> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or the anon key).");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async (path: string) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
    return res.json();
  };

  const films: { id: string }[] = await get(`films?select=id&language=eq.${encodeURIComponent(lang)}`);
  console.log(`${films.length} ${lang} films`);
  const docs: string[][][] = [];
  for (const { id } of films) {
    const subs: { text: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const page: { text: string }[] = await get(
        `subtitles?select=text&film_id=eq.${id}&order=sort_order.asc&offset=${from}&limit=1000`,
      );
      subs.push(...page);
      if (page.length < 1000) break;
    }
    if (subs.length) docs.push(subs.map((s) => tokenize(s.text)).filter((l) => l.length > 0));
  }
  return docs;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const writeCsv = (path: string, header: string[], rows: unknown[][]) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
  console.log(`wrote ${rows.length} rows to ${path}`);
};

async function main() {
  const dir = flag("--dir");
  const lang = flag("--supabase");
  if (!dir && !lang) {
    console.error("Usage: npx tsx scripts/phrases/antconc.ts (--dir PATH | --supabase LANG) [--out PREFIX] [--lemmas FILE]");
    process.exit(1);
  }
  const docs = dir ? fromDir(dir) : await fromSupabase(lang!);
  const words = docs.reduce((s, d) => s + d.reduce((t, l) => t + l.length, 0), 0);
  console.log(`${docs.length} documents, ${words.toLocaleString()} words`);

  const lemmas = new Map<string, string>();
  const lemmaFile = flag("--lemmas");
  if (lemmaFile) {
    for (const line of readFileSync(lemmaFile, "utf8").trim().split("\n").slice(1)) {
      const [w, l] = line.split("\t");
      lemmas.set(w, l);
    }
  }

  const ngrams = countNgrams(docs, {
    minN: num("--min-n", 2),
    maxN: num("--max-n", 5),
    minFreq: num("--min-freq", 3),
    minRange: num("--min-range", 2),
  });
  const out = flag("--out") ?? `data/${lang ?? "corpus"}/antconc`;

  writeCsv(
    `${out}-ngrams.csv`,
    ["phrase", "n", "freq", "range", "range_pct", "mi", "lemma_key"],
    ngrams.map((g) => [
      g.gram,
      g.n,
      g.freq,
      g.range,
      Math.round((g.range / docs.length) * 1000) / 10,
      g.mi === null ? "" : Math.round(g.mi * 100) / 100,
      lemmas.size ? lemmaKey(g.gram, (w) => lemmas.get(w)) : "",
    ]),
  );

  const frames = extractFrames(ngrams, { minN: 3, maxN: 5, minVariants: 3 });
  writeCsv(
    `${out}-frames.csv`,
    ["frame", "n", "freq", "variants", "type_token_ratio", "top_fillers"],
    frames.map((f) => [
      f.frame,
      f.n,
      f.freq,
      f.variants,
      Math.round(f.typeTokenRatio * 1000) / 1000,
      f.topFillers.map((x) => `${x.word} (${x.freq})`).join(" | "),
    ]),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
