#!/usr/bin/env -S npx tsx
/**
 * Populate/refresh core_vocabulary with real frequency data.
 *
 * Source: hermitdave/FrequencyWords (github.com/hermitdave/FrequencyWords),
 * word-frequency lists generated from OpenSubtitles2018 — CC-BY-SA 3.0 for
 * the data, MIT for the generator code. Genuinely open, and thematically
 * exact for a subtitle-based app: it's literally frequency-in-real-subtitles
 * for 60+ languages, which is a defensible, industry-standard stand-in for
 * an official CEFR list (those — Oxford 3000/5000, Cambridge English
 * Vocabulary Profile, Pearson GSE — are proprietary and can't be
 * redistributed). core_vocabulary.cefr_level is already derived from
 * frequency rank via fixed bands (see the Aug 29 migration); this script
 * just makes sure `rank` itself reflects real data for every language you
 * support, not only whichever ones were seeded by hand originally.
 *
 * KNOWN LIMITATIONS (documented, not silently swept under the rug):
 *  - These are SURFACE-FORM frequencies, not lemma frequencies. "manger",
 *    "manges" and "mangent" each get their own row/rank, the same way they'd
 *    each get their own saved_words row today. Merging conjugations into one
 *    lemma-frequency entry needs a real per-language lemmatizer and is a
 *    reasonable follow-up, not a blocker for shipping real frequency data.
 *  - No translations. Translating tens of thousands of words per language
 *    upfront is a real, non-trivial AI cost for words most learners will
 *    never see. core_vocabulary.translation is nullable (see the
 *    accompanying migration) — left blank here, filled lazily the same way
 *    saved_words.translation already is (via the translate-word edge
 *    function) the first time a word actually surfaces to a learner.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-core-vocabulary.ts [lang...]
 *   (no lang args = every language in src/lib/languages.ts)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-core-vocabulary.ts [lang...]");
  console.error("Find the service role key at: Supabase Dashboard -> Settings -> API -> service_role");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Our language codes (src/lib/languages.ts) -> hermitdave's folder name,
// where they differ. zh/pt have regional variants upstream; these are the
// most learner-relevant defaults (Simplified/Mandarin, Brazilian Portuguese)
// — pass an explicit override as a CLI arg if you want the alternative.
const HERMITDAVE_CODE: Record<string, string> = {
  zh: "zh_cn",
  pt: "pt_br",
};

const ALL_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "th", "ru", "tr", "nl", "pl", "sv"];

// Matches the bands already applied to existing core_vocabulary rows in
// supabase/migrations/20260829171216_..._multi_language_profiles.sql —
// keep these two in sync if either changes.
function cefrLevelForRank(rank: number): string {
  if (rank <= 600) return "a1";
  if (rank <= 1200) return "a2";
  if (rank <= 2500) return "b1";
  if (rank <= 4500) return "b2";
  if (rank <= 9000) return "c1";
  return "c2";
}

// Enough to cover the C2 cumulative target (16,000) with headroom.
const WORDS_PER_LANGUAGE = 20000;
const UPSERT_BATCH_SIZE = 500;

async function fetchFrequencyList(hermitCode: string): Promise<{ word: string; count: number }[]> {
  const bases = [
    `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${hermitCode}/${hermitCode}_full.txt`,
    `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${hermitCode}/${hermitCode}_50k.txt`,
    `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/${hermitCode}/${hermitCode}_50k.txt`,
  ];
  for (const url of bases) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const text = await res.text();
    const rows: { word: string; count: number }[] = [];
    for (const line of text.split("\n")) {
      const [word, countStr] = line.trim().split(/\s+/);
      if (!word || !countStr) continue;
      const count = Number(countStr);
      if (!Number.isFinite(count)) continue;
      // Skip pure punctuation/digit "words" — noise from subtitle timestamps
      // and stray symbols, not vocabulary.
      if (!/\p{L}/u.test(word)) continue;
      rows.push({ word, count });
      if (rows.length >= WORDS_PER_LANGUAGE) break;
    }
    if (rows.length > 0) return rows;
  }
  return [];
}

async function seedLanguage(lang: string) {
  const hermitCode = HERMITDAVE_CODE[lang] ?? lang;
  process.stdout.write(`${lang} (${hermitCode}): fetching... `);
  const words = await fetchFrequencyList(hermitCode);
  if (words.length === 0) {
    console.log("no frequency list found upstream — skipped");
    return;
  }
  console.log(`${words.length} words, upserting...`);

  const maxCount = words[0].count;
  const rows = words.map((w, i) => ({
    language: lang,
    rank: i + 1,
    word: w.word,
    lemma: w.word, // surface-form approximation — see file header
    translation: null as string | null,
    pos: null as string | null,
    frequency_weight: maxCount > 0 ? w.count / maxCount : 0,
    cefr_level: cefrLevelForRank(i + 1),
  }));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("core_vocabulary")
      .upsert(batch, { onConflict: "language,lemma" });
    if (error) {
      console.error(`  batch ${i / UPSERT_BATCH_SIZE + 1} failed:`, error.message);
      continue;
    }
    upserted += batch.length;
  }
  console.log(`  ${lang}: upserted ${upserted}/${rows.length}`);
}

async function main() {
  const requested = process.argv.slice(2);
  const languages = requested.length > 0 ? requested : ALL_LANGUAGES;
  console.log(`Seeding core_vocabulary for: ${languages.join(", ")}\n`);
  for (const lang of languages) {
    try {
      await seedLanguage(lang);
    } catch (err) {
      console.error(`${lang}: failed —`, (err as Error).message);
    }
  }
  console.log("\nDone. Words are seeded without translations (nullable) — they fill in lazily via translate-word the first time a learner actually sees one.");
}

main();
