#!/usr/bin/env -S npx tsx
/**
 * Overlay REAL CEFR-graded vocabulary on top of the frequency-derived bands
 * that scripts/seed-core-vocabulary.ts computes.
 *
 * core_vocabulary.cefr_level is currently a heuristic: bucket by frequency
 * rank. That's a fine stand-in where nothing better exists, but a word can
 * be common in subtitles yet conceptually advanced (or the reverse — rare in
 * subtitles, taught on day one). Where an actual graded wordlist exists,
 * its label should win.
 *
 * SOURCE (English only, for now):
 *   CEFR-J Vocabulary Profile v1.5 — Yukio Tono / Tono Laboratory, Tokyo
 *   University of Foreign Studies. License: free for research AND
 *   commercial use with citation (see http://www.cefr-j.org/download.html).
 *   Covers A1-B2, ~7,800 headwords with real graded CEFR labels from
 *   corpus-based research on English learner textbooks, not a frequency
 *   proxy.
 *
 *   Octanove Vocabulary Profile C1/C2 v1.0 — extends CEFR-J's coverage to
 *   C1/C2. License: CC BY-SA 4.0.
 *
 *   Both mirrored (with the original authors' permission — see the repo's
 *   README) at github.com/openlanguageprofiles/olp-en-cefrj, which is what
 *   this script fetches from (raw.githubusercontent.com, no auth needed).
 *
 * WHY NOT MORE LANGUAGES YET: CEFRLex (cental.uclouvain.be) hosts real
 * graded lexicons for French (FLELex), German (DAFlex), Swedish (SVALex)
 * and Spanish (ELELex) — genuinely the right source to add next — but that
 * domain wasn't reachable from the sandbox this script was written in, so
 * its exact download mechanics and license text couldn't be verified here.
 * Kelly (sv/en/no/el/it/pl/ar/zh/ru) and NT2Lex (Dutch) were both checked
 * and ruled out: both are CC BY-NC-SA — non-commercial only — which doesn't
 * fit an app with a paid tier. Every other language keeps the frequency-
 * rank heuristic as its only source until a commercially-usable graded list
 * is found for it.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/apply-cefr-overrides.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/apply-cefr-overrides.ts");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CEFR_RANK: Record<string, number> = { a1: 0, a2: 1, b1: 2, b2: 3, c1: 4, c2: 5 };

const SOURCES = [
  "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv",
  "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv",
];

interface Entry {
  word: string;
  level: string;
  pos: string | null;
}

// Naive CSV split is fine here — both source files are plain
// headword,pos,CEFR[,...] rows with no embedded commas or quoting.
function parseCsv(text: string): Entry[] {
  const entries: Entry[] = [];
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [headword, pos, cefr] = line.split(",");
    if (!headword || !cefr) continue;
    const level = cefr.trim().toLowerCase();
    if (!(level in CEFR_RANK)) continue;

    // Some CEFR-J headwords list variant spellings/forms joined by "/"
    // (e.g. "a.m./A.M./am/AM"). Multi-word phrases ("as long as") are
    // skipped — core_vocabulary is single-token, one row per lemma.
    for (const variant of headword.split("/")) {
      const word = variant.trim().toLowerCase();
      if (!word || /\s/.test(word)) continue;
      entries.push({ word, level, pos: pos?.trim() || null });
    }
  }
  return entries;
}

// A word can appear more than once (different POS, sometimes different
// levels — e.g. "above" is A1 as a preposition/adverb but B1 as an
// adjective). Keep the EASIEST level per word: the app uses this to decide
// whether a learner should already know a word, and a word usable at A1 in
// its common sense shouldn't be flagged as B1-and-up because of a rarer one.
function dedupeByEasiestLevel(entries: Entry[]): Entry[] {
  const byWord = new Map<string, Entry>();
  for (const entry of entries) {
    const existing = byWord.get(entry.word);
    if (!existing || CEFR_RANK[entry.level] < CEFR_RANK[existing.level]) {
      byWord.set(entry.word, entry);
    }
  }
  return [...byWord.values()];
}

const RPC_BATCH_SIZE = 1000;

async function main() {
  console.log("Fetching CEFR-J + Octanove C1/C2 graded vocabulary...");
  const all: Entry[] = [];
  for (const url of SOURCES) {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  failed to fetch ${url}: ${res.status}`);
      continue;
    }
    const parsed = parseCsv(await res.text());
    console.log(`  ${url.split("/").pop()}: ${parsed.length} rows`);
    all.push(...parsed);
  }

  const entries = dedupeByEasiestLevel(all);
  console.log(`\n${entries.length} unique graded English words. Applying to core_vocabulary...`);

  let applied = 0;
  for (let i = 0; i < entries.length; i += RPC_BATCH_SIZE) {
    const batch = entries.slice(i, i + RPC_BATCH_SIZE);
    const { data, error } = await supabase.rpc("apply_cefr_overrides", {
      _language: "en",
      _entries: batch,
    });
    if (error) {
      console.error(`  batch ${i / RPC_BATCH_SIZE + 1} failed:`, error.message);
      continue;
    }
    applied += (data as number) ?? 0;
    console.log(`  batch ${i / RPC_BATCH_SIZE + 1}: applied ${data}`);
  }

  console.log(`\nDone. ${applied}/${entries.length} words now carry a real CEFR-J-graded level instead of a frequency-rank guess.`);
}

main();
