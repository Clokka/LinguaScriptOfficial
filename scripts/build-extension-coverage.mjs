// Copies the essential phrases (below) and the film & TV word counts (src/data/wordlists/<lang>.json, from
// OpenSubtitles 2018 via FrequencyWords, CC BY-SA 4.0) into the extension as
// extension/dict/coverage/<lang>.json, so the pop-up's "Vocabulary growth"
// card can say what share of the words in films & TV the learner's words are.
// Run after `node scripts/build-word-lists.mjs …`:
//   node scripts/build-extension-coverage.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const SRC = 'src/data/wordlists';
const OUT = 'extension/dict/coverage';
mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(SRC).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(`${SRC}/${file}`, 'utf8'));
  const counts = d.words.map((x) => x.c);
  const top = counts.reduce((a, c) => a + c, 0);
  // The lists keep the top 3,000 words but coverage is measured against the
  // WHOLE corpus. Use the stored total if the list has one, else get it back
  // from the measured "top 3,000 = N%" figure (rounded to 0.1, so ±0.06%).
  const total = d.total || Math.round(top / (d.coverage['3000'] / 100));
  const out = {
    lang: d.lang, source: d.source, sourceUrl: d.sourceUrl, licence: d.licence, builtAt: d.builtAt,
    total, w: d.words.map((x) => x.w).join('\n'), c: counts,
  };
  writeFileSync(`${OUT}/${file}`, JSON.stringify(out));
  console.log(`${OUT}/${file}: ${counts.length} words, top 100 = ${(counts.slice(0, 100).reduce((a, c) => a + c, 0) / total * 100).toFixed(1)}%`);
}

// Essential phrases (packages/core/src/phrases/<lang>.json): the extension's
// "🔓 New phrase unlocked" pop-up reads the same blueprint as the website.
const PH = 'packages/core/src/phrases';
mkdirSync('extension/dict/phrases', { recursive: true });
for (const file of readdirSync(PH).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(`${PH}/${file}`, 'utf8'));
  // The extension only needs what the pop-up shows and checks.
  const slim = { lang: d.lang, phrases: d.phrases.map(({ id, level, fn, text, en, keys }) => ({ id, level, fn, text, en, keys })) };
  writeFileSync(`extension/dict/phrases/${file}`, JSON.stringify(slim));
  console.log(`extension/dict/phrases/${file}: ${slim.phrases.length} phrases`);
}
