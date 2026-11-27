#!/usr/bin/env node
// Builds src/data/wordlists/<lang>.json for the /words SEO pages
// (docs/plans/frequency-word-lists-seo.md).
//   node scripts/build-word-lists.mjs es fr de it pt en zh_cn ja
// Source: hermitdave/FrequencyWords, OpenSubtitles 2018 (CC BY-SA 4.0).
// Keeps the top 3,000 clean words with counts and computes coverage from the
// counts, so every percentage on the pages is measured, never typed by hand.
// Meanings: French from our instant pack (public/dict/fr-en.v1.json); the top
// 100 of other languages from hand-checked files in scripts/word-meanings/<lang>.json.
// The rest are filled in on the page from public.word_dictionary.
// Chinese (zh_cn) and Japanese (ja): their words are real one-character words
// (的 我 你 の), so the "single letters are junk" rule is OFF for them, and only
// words written in Han / kana count (no stray "ok" or "mr"). Their hand-checked
// entries can be ["reading", "meaning"] (pinyin / kana), saved as `p` on the row.
import fs from "node:fs";
import path from "node:path";

const KEEP = 3000;
const SINGLE_OK = { es: "yaoeu", fr: "aày", de: "", it: "eaoèi", pt: "aoeéà", pt_br: "aoeéà", en: "ai" };
const CJK = new Set(["zh_cn", "ja"]);
const CJK_WORD = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
// Japanese has no 50k file in the project, only the full list (we keep the top 3,000 anyway).
const SOURCE_FILE = { ja: "ja/ja_full.txt" };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const langs = process.argv.slice(2);
if (!langs.length) { console.error("usage: node scripts/build-word-lists.mjs es fr de it pt en zh_cn ja"); process.exit(1); }

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);
const frPack = readJson(path.join(root, "public/dict/fr-en.v1.json"));

for (const lang of langs) {
  const url = `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${SOURCE_FILE[lang] ?? `${lang}/${lang}_50k.txt`}`;
  const raw = await (await fetch(url)).text();
  const rows = raw.split("\n").map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 2)
    .map(([w, c]) => [w.toLowerCase(), Number(c)]);
  const total = rows.reduce((a, [, c]) => a + c, 0);

  const ok = SINGLE_OK[lang] ?? "";
  const seen = new Set();
  const words = [];
  const removed = [];
  for (const [w, c] of rows) {
    if (seen.has(w)) continue;
    seen.add(w);
    const letters = /^[\p{L}][\p{L}'’-]*$/u.test(w);
    // Elided words (l', j', c', qu'…) are real words in French/Italian; elsewhere a
    // leading/trailing apostrophe is a contraction fragment ('s, 't, 're).
    const elided = (lang === "fr" || lang === "it") && /^[\p{L}]+['’]$/u.test(w);
    const fragment = !elided && /['’]$|^['’]/.test(w);
    const single = !CJK.has(lang) && [...w].length === 1 && !ok.includes(w);
    const notCjk = CJK.has(lang) && !CJK_WORD.test(w);
    if (!letters || fragment || single || notCjk) { if (words.length < KEEP) removed.push(w); continue; }
    words.push({ w, c });
  }
  // Words needed for 50/75/80/90% of all word uses (whole clean list), then keep the top KEEP.
  const needFor = {};
  { let sum = 0; const goals = [50, 75, 80, 90]; for (let i = 0; i < words.length && goals.length; i++) {
    sum += words[i].c; while (goals.length && (sum / total) * 100 >= goals[0]) needFor[goals.shift()] = i + 1; } }
  words.length = Math.min(words.length, KEEP);

  // Coverage = share of all word uses (whole 50k list) covered by the CLEANED top n shown on the page.
  const share = (n) => Math.round((words.slice(0, n).reduce((a, { c }) => a + c, 0) / total) * 1000) / 10;
  const hand = readJson(path.join(root, "scripts/word-meanings", `${lang.replace("_br", "").replace("_cn", "")}.json`)) || {};
  const frMeaning = (w) => {
    const d = frPack?.words || {};
    return typeof d[w] === "string" ? d[w] : Array.isArray(d[w]) ? d[w][0] : "";
  };
  const list = words.map(({ w, c }, i) => {
    // A hand entry is "meaning" or ["reading", "meaning"] (Chinese pinyin / Japanese kana).
    const h = hand[w];
    const [p, m] = Array.isArray(h) ? h : ["", h || (lang === "fr" ? frMeaning(w) : "")];
    return { r: i + 1, w, c, ...(m ? { m } : {}), ...(p ? { p } : {}) };
  });

  const out = {
    lang,
    source: "OpenSubtitles 2018 via hermitdave/FrequencyWords",
    sourceUrl: "https://github.com/hermitdave/FrequencyWords",
    licence: "CC BY-SA 4.0",
    builtAt: new Date().toISOString().slice(0, 10),
    coverage: { 100: share(100), 500: share(500), 1000: share(1000), 3000: share(3000) },
    needFor,
    removedSample: removed.slice(0, 40),
    words: list,
  };
  const dir = path.join(root, "src/data/wordlists");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify(out));
  const withMeaning = list.filter((x) => x.m).length;
  console.log(`${lang}: ${list.length} words, need ${JSON.stringify(needFor)}, coverage ${JSON.stringify(out.coverage)}, meanings ${withMeaning}, removed ${removed.length} (e.g. ${removed.slice(0, 8).join(" ")})`);
}
