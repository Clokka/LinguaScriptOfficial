#!/usr/bin/env node
// Adds the look-alike words (moment, question, possible…) and hand-written grammar words the first
// build dropped. Needs no translating, only the two frequency lists.
//   node scripts/patch-instant-dict.mjs fr en 15000 && node scripts/sync-instant-dict.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { OVERRIDES, englishWords } from "./instant-dict-fixes.mjs";

const [from = "fr", to = "en", countArg = "15000"] = process.argv.slice(2);
const file = `public/dict/${from}-${to}.v1.json`;
const pack = JSON.parse(readFileSync(file, "utf8"));
const key = (w) => w.toLowerCase().replace(/[.,!?;:"'`«»()\[\]…]/g, "").trim();
const en = await englishWords();
const list = (await (await fetch(`https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${from}/${from}_50k.txt`)).text())
  .split("\n").map((l) => l.split(" ")[0]).filter(Boolean).slice(0, Number(countArg));

let added = 0, overridden = 0;
for (const w of list) {
  const k = key(w);
  if (!k || pack.words[k] || !/^[\p{L}][\p{L}'’-]*$/u.test(w) || /['’]$/.test(w)) continue;
  const plain = k.normalize("NFD").replace(/\p{M}/gu, ""); // téléphone → telephone
  if (en.has(k)) { pack.words[k] = k; added++; }              // a real look-alike: the word means itself
  else if (plain !== k && en.has(plain)) { pack.words[k] = plain; added++; } // …with the English spelling
}
for (const [w, g] of Object.entries(OVERRIDES[from] || {})) { if (pack.words[w] !== g) { pack.words[w] = g; overridden++; } }
pack.built = new Date().toISOString().slice(0, 10);
writeFileSync(file, JSON.stringify(pack));
console.log(`${file}: +${added} look-alike words, ${overridden} hand-written → ${Object.keys(pack.words).length} words`);
