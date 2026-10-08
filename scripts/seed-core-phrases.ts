#!/usr/bin/env -S npx tsx
/**
 * Load reviewed chunks and phrase-frames into core_phrases.
 *
 * Reads data/<lang>/<lang>-chunks.csv and <lang>-frames.csv (built by
 * scripts/phrases/build-french-data.ts). A row loads when its `keep` column
 * says "yes" (reviewed = true). With --include-auto, rows nobody has reviewed
 * yet but that the build marked auto_keep=yes load too, with reviewed = false,
 * so the app can start using them while review catches up. `keep` = "no"
 * never loads.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-core-phrases.ts fr [--include-auto]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const lang = process.argv[2];
const includeAuto = process.argv.includes("--include-auto");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !lang) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-core-phrases.ts <lang> [--include-auto]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BATCH = 500;

/** Minimal CSV reader: quoted cells, doubled quotes, no embedded newlines. */
function readCsv(path: string): Record<string, string>[] {
  const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const parse = (line: string) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    return cells;
  };
  const cols = parse(header);
  return lines.map((l) => Object.fromEntries(parse(l).map((v, i) => [cols[i], v])));
}

/** "j' ai besoin de *" -> "j'ai besoin de ___" */
const display = (matchForm: string) => matchForm.replace(/' /g, "'").replace(/\*/g, "___");

const wanted = (r: Record<string, string>) => {
  const keep = r.keep?.trim().toLowerCase();
  if (keep === "no") return false;
  return keep === "yes" || (includeAuto && r.auto_keep === "yes");
};

async function upsert(rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from("core_phrases")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "language,kind,match_form" });
    if (error) throw error;
  }
}

async function main() {
  const chunks = readCsv(`data/${lang}/${lang}-chunks.csv`).filter(wanted).map((r) => ({
    language: lang,
    kind: "chunk",
    phrase: display(r.phrase),
    match_form: r.phrase,
    lemma_key: r.lemma_key || null,
    n: Number(r.n),
    rank: Number(r.rank) || null,
    frequency: Number(r.freq_books) || null,
    mi: r.mi === "" ? null : Number(r.mi),
    source: "google-books-ngrams",
    reviewed: r.keep?.trim().toLowerCase() === "yes",
  }));

  const frames = readCsv(`data/${lang}/${lang}-frames.csv`).filter(wanted).map((r) => ({
    language: lang,
    kind: "frame",
    phrase: display(r.frame),
    match_form: r.frame,
    n: Number(r.n),
    rank: Number(r.rank) || null,
    frequency: Number(r.freq_books) || null,
    top_fillers: r.top_fillers ? r.top_fillers.split(" | ") : null,
    source: "google-books-ngrams",
    reviewed: r.keep?.trim().toLowerCase() === "yes",
  }));

  await upsert(chunks);
  await upsert(frames);
  console.log(`loaded ${chunks.length} chunks and ${frames.length} frames for ${lang}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
