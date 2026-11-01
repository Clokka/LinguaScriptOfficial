/**
 * Measures how many top words cover 10/20/30/40/50% of real film & TV speech,
 * per language, from the SAME list core_vocabulary is seeded from
 * (hermitdave/FrequencyWords, OpenSubtitles 2018, full list, surface forms,
 * tokens without a letter skipped — exactly like seed-core-vocabulary.ts).
 *
 *   npx tsx scripts/measure-speed-run-cuts.ts
 *
 * Paste the printed table into SPEED_RUN_CUTS in src/lib/speedRun.ts.
 * No credentials needed; it only downloads public text files.
 */
const LANGS = ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "th", "ru", "tr", "nl", "pl", "sv"];
const CODE: Record<string, string> = { zh: "zh_cn", pt: "pt_br" }; // keep in sync with seed-core-vocabulary.ts
const TARGETS = [10, 20, 30, 40, 50];

async function measure(lang: string): Promise<number[] | null> {
  const code = CODE[lang] ?? lang;
  const res = await fetch(`https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${code}/${code}_full.txt`);
  if (!res.ok) return null;
  const counts: number[] = [];
  for (const line of (await res.text()).split("\n")) {
    const [word, n] = line.trim().split(/\s+/);
    const count = Number(n);
    if (!word || !Number.isFinite(count) || !/\p{L}/u.test(word)) continue;
    counts.push(count);
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const cuts: number[] = [];
  let cum = 0;
  for (let i = 0; i < counts.length && cuts.length < TARGETS.length; i++) {
    cum += counts[i];
    while (cuts.length < TARGETS.length && (cum / total) * 100 >= TARGETS[cuts.length]) cuts.push(i + 1);
  }
  return cuts;
}

for (const lang of LANGS) {
  const cuts = await measure(lang);
  console.log(cuts ? `  ${lang}: [${cuts.join(", ")}],` : `  // ${lang}: no list upstream`);
}
