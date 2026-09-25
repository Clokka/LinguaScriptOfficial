#!/usr/bin/env -S npx tsx
/**
 * Build the French chunk curriculum's candidate lists.
 *
 * Inputs (downloaded automatically into --cache if missing):
 *  - hermitdave/FrequencyWords fr_full.txt — word counts from OpenSubtitles 2018
 *    (CC-BY-SA 3.0). Spoken, subtitle-based: our "how common in real speech".
 *  - orgtre/google-books-ngram-frequency — the most frequent French 1–5-grams
 *    from Google Books (CC BY 3.0). Written, but the only large open French
 *    phrase counts we can reach; scripts/phrases/antconc.ts re-ranks chunks by
 *    LinguaScript's own transcripts once they're exported.
 *  - data/fr/fr-lemmas.tsv — word -> dictionary form (export-spacy-lemmas.py).
 *
 * Outputs (data/fr/):
 *  - fr-lemma-frequency.csv  one row per word family ("manger" = all its forms)
 *  - fr-chunks.csv           2–5 word phrases, scored, with an auto_keep guess
 *  - fr-frames.csv           phrase-frames ("j' ai besoin de *") for the Sentence Lab
 *
 * The chunk and frame files have an empty `keep` column: a human (TEFL eye!)
 * marks yes/no, then scripts/seed-core-phrases.ts loads the "yes" rows.
 *
 * Usage: npx tsx scripts/phrases/build-french-data.ts [--cache DIR]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractFrames, lemmaKey, SLOT } from "../../src/lib/phraseFrames";

const args = process.argv.slice(2);
const CACHE = args.includes("--cache") ? args[args.indexOf("--cache") + 1] : ".cache/phrases";
const OUT = "data/fr";

const SOURCES: Record<string, string> = {
  "fr_full.txt": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_full.txt",
  ...Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [
      `gb_${n}grams_fr.csv`,
      `https://raw.githubusercontent.com/orgtre/google-books-ngram-frequency/main/ngrams/${n}grams_french.csv`,
    ]),
  ),
};

/**
 * Grammar words: never taught alone, only inside a phrase. A chunk made only
 * of these is still fine ("il y a") — this list is for spotting fragments.
 */
const FUNCTION_WORDS = new Set(
  (
    "de d' la le les l' un une des du au aux à et ou en que qu' qui il elle ils elles on je j' tu nous vous " +
    "me m' te t' se s' ce c' ne n' y a est pas plus par pour sur dans avec sans son sa ses leur leurs mon ma mes " +
    "ton ta tes notre nos votre vos cette ces cet mais si comme"
  ).split(" "),
);
const DETERMINERS = new Set("le la les l' un une des du au aux mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ce cet cette ces".split(" "));
/** A phrase ending on one of these is a fragment ("besoin d' un"), not a chunk. */
const BAD_ENDINGS = new Set("de d' la le les l' un une des du au aux à et ou que qu' en par pour sur dans avec son sa ses mon ma mes ton ta tes ce cette ces se s' ne n' me m' te t'".split(" "));
/** Written-register giveaways that rarely belong in a spoken-French curriculum. */
const BOOKISH = /\b(dont|lequel|laquelle|lesquels|auquel|celle-ci|celui-ci|cependant|toutefois|ainsi que|au sein|dans le cadre|en effet|il convient|il s' agit)\b/;

async function ensureSources() {
  mkdirSync(CACHE, { recursive: true });
  for (const [file, url] of Object.entries(SOURCES)) {
    const path = join(CACHE, file);
    if (existsSync(path)) continue;
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    writeFileSync(path, await res.text());
  }
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const writeCsv = (path: string, header: string[], rows: unknown[][]) => {
  writeFileSync(path, [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
  console.log(`wrote ${rows.length} rows to ${path}`);
};

function readNgrams(n: number): { gram: string; freq: number }[] {
  return readFileSync(join(CACHE, `gb_${n}grams_fr.csv`), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      // Columns: ngram,freq[,cumshare,en]. The n-gram is only quoted when it
      // contains a comma, which French n-grams here never do.
      const [gram, freq] = line.split(",");
      return { gram: gram.replace(/^"|"$/g, ""), freq: Number(freq) };
    })
    .filter((r) => r.gram && Number.isFinite(r.freq));
}

async function main() {
  await ensureSources();

  // ── Word families ────────────────────────────────────────────────────────
  const lemmaOf = new Map<string, string>();
  for (const line of readFileSync(join(OUT, "fr-lemmas.tsv"), "utf8").trim().split("\n").slice(1)) {
    const [word, lemma] = line.split("\t");
    lemmaOf.set(word, lemma);
  }
  const subtitleRank = new Map<string, number>();
  const family = new Map<string, { freq: number; forms: [string, number][] }>();
  readFileSync(join(CACHE, "fr_full.txt"), "utf8")
    .split("\n")
    .slice(0, 50_000)
    .forEach((line, i) => {
      const [word, count] = line.trim().split(" ");
      if (!word) return;
      subtitleRank.set(word, i + 1);
      const lemma = lemmaOf.get(word) ?? word;
      const f = family.get(lemma) ?? { freq: 0, forms: [] };
      f.freq += Number(count);
      f.forms.push([word, Number(count)]);
      family.set(lemma, f);
    });
  const families = [...family.entries()].sort((a, b) => b[1].freq - a[1].freq);
  writeCsv(
    join(OUT, "fr-lemma-frequency.csv"),
    ["lemma", "family_rank", "family_freq", "forms"],
    families.slice(0, 20_000).map(([lemma, f], i) => [
      lemma,
      i + 1,
      f.freq,
      f.forms.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w).join(" "),
    ]),
  );

  // ── Chunks ───────────────────────────────────────────────────────────────
  // MI needs the corpus size; the 1-gram list gives each word's share of it.
  const unigrams = readNgrams(1);
  const lastLine = readFileSync(join(CACHE, "gb_1grams_fr.csv"), "utf8").trim().split("\n").at(-1)!;
  const cumshare = Number(lastLine.split(",")[2]);
  const topTotal = unigrams.reduce((s, r) => s + r.freq, 0);
  const corpusSize = cumshare > 0 ? topTotal / cumshare : topTotal;
  const wordFreq = new Map(unigrams.map((r) => [r.gram, r.freq]));

  const mi = (gram: string, freq: number): number | null => {
    let logExpected = 0;
    for (const w of gram.split(" ")) {
      const f = wordFreq.get(w);
      if (!f) return null;
      logExpected += Math.log2(f / corpusSize);
    }
    return Math.log2(freq / corpusSize) - logExpected;
  };

  const allNgrams = [2, 3, 4, 5].flatMap(readNgrams);
  const chunkRows = allNgrams
    .map(({ gram, freq }) => {
      const words = gram.split(" ");
      const score = mi(gram, freq);
      // "Spoken-friendly": every word is in the top 20k of real subtitles.
      const spoken = words.every((w) => (subtitleRank.get(w) ?? Infinity) <= 20_000);
      const fragment = BAD_ENDINGS.has(words.at(-1)!) || words[0] === "et" || words[0] === "de";
      const bookish = BOOKISH.test(gram);
      const allFunction = words.every((w) => FUNCTION_WORDS.has(w));
      // "la vie", "un homme": just a word with its article — teach the word.
      const articlePlusWord = words.length === 2 && DETERMINERS.has(words[0]);
      // Tight, spoken, complete phrases. All-grammar chunks must be very
      // tightly bound (MI) to count — that keeps "il y a", drops "et de la".
      const autoKeep =
        spoken && !fragment && !bookish && !articlePlusWord && score !== null && score >= (allFunction ? 6 : 3);
      return {
        gram,
        n: words.length,
        freq,
        mi: score === null ? null : Math.round(score * 100) / 100,
        key: lemmaKey(gram, (w) => lemmaOf.get(w)),
        spoken,
        autoKeep,
        why: [fragment && "fragment", articlePlusWord && "article + word", bookish && "written style", !spoken && "rare word", score !== null && score < 3 && "loose"]
          .filter(Boolean)
          .join("; "),
      };
    })
    .sort((a, b) => b.freq - a.freq);

  writeCsv(
    join(OUT, "fr-chunks.csv"),
    ["phrase", "n", "freq_books", "rank", "mi", "lemma_key", "spoken_words", "auto_keep", "auto_reason", "keep", "notes"],
    chunkRows.map((r, i) => [r.gram, r.n, r.freq, i + 1, r.mi, r.key, r.spoken ? "yes" : "no", r.autoKeep ? "yes" : "no", r.why, "", ""]),
  );

  // ── Phrase-frames ────────────────────────────────────────────────────────
  const frames = extractFrames(allNgrams, { minN: 3, maxN: 5, minVariants: 3 });
  writeCsv(
    join(OUT, "fr-frames.csv"),
    ["frame", "n", "freq_books", "rank", "variants", "type_token_ratio", "top_fillers", "auto_keep", "keep", "notes"],
    frames.map((f, i) => {
      const fixed = f.frame.split(" ").filter((w) => w !== SLOT);
      // The gap must take real words ("je suis * " → désolé, sûr, là), not
      // just de/du/des — that's one chunk with contractions, not a frame.
      const contentFillers = f.topFillers.filter((x) => !FUNCTION_WORDS.has(x.word)).length;
      const autoKeep =
        contentFillers >= 3 &&
        fixed.every((w) => (subtitleRank.get(w) ?? Infinity) <= 20_000) &&
        !fixed.every((w) => FUNCTION_WORDS.has(w)) &&
        !BOOKISH.test(f.frame);
      return [
        f.frame,
        f.n,
        f.freq,
        i + 1,
        f.variants,
        Math.round(f.typeTokenRatio * 1e6) / 1e6,
        f.topFillers.map((x) => x.word).join(" | "),
        autoKeep ? "yes" : "no",
        "",
        "",
      ];
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
