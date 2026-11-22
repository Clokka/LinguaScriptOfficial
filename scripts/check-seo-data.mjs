import assert from "node:assert/strict";
import fs from "node:fs";
import { LANGS, wordPagePaths } from "./word-pages.mjs";
import { CORPUS_TOTALS, vocabularyCoverage } from "./word-list-data.mjs";

for (const lang of LANGS) {
  const data = JSON.parse(fs.readFileSync(`src/data/wordlists/${lang.file}.json`, "utf8"));
  for (const size of [100, 1000, 3000]) {
    assert.equal(vocabularyCoverage(data, size), data.coverage[size], `${lang.name}: match original source coverage`);
  }
  const top50 = data.words.slice(0, 50);
  assert.equal(top50.length, 50);
  assert.equal(top50.at(-1).r, 50);
  const expected = Math.round(top50.reduce((sum, w) => sum + w.c, 0) / CORPUS_TOTALS[lang.file] * 1000) / 10;
  assert.equal(vocabularyCoverage(data, 50), expected);
  assert.ok(wordPagePaths().includes(`/words/${lang.slug}/top-50`));
  assert.ok(!wordPagePaths().includes(`/words/${lang.slug}/top-100`), "Avoid duplicate canonical top-100 pages");
}
assert.equal(vocabularyCoverage(JSON.parse(fs.readFileSync("src/data/wordlists/fr.json", "utf8")), 50), 46.6);
assert.equal(new Set(wordPagePaths()).size, wordPagePaths().length);
console.log("SEO corpus coverage and list-size rules passed for all six languages.");