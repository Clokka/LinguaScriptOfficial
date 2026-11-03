#!/usr/bin/env node
// Builds public/dict/<from>-<to>.v1.json: the most common words of a language
// (from film/TV subtitles) with their meanings, so a tapped word is answered
// on the device with no network at all (src/lib/instantDict.ts).
//
//   node scripts/build-instant-dict.mjs fr en 15000
//
// Words: hermitdave/FrequencyWords, OpenSubtitles 2018 (CC BY-SA 4.0) — the
// same list the seed-dictionary function uses. Meanings: Google Translate,
// one word per line in batches (same as seed-dictionary).
import { writeFileSync, mkdirSync } from "node:fs";

const [from = "fr", to = "en", countArg = "15000"] = process.argv.slice(2);
const COUNT = Number(countArg);
const LIST = `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${from}/${from}_50k.txt`;
const BATCH = 80;

const key = (w) => w.toLowerCase().replace(/[.,!?;:"'`«»()\[\]…]/g, "").trim();
const flat = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");

async function translateBatch(words) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${from}&tl=${to}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ q: words.join("\n") }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const text = (data?.[0] ?? []).map((p) => (typeof p?.[0] === "string" ? p[0] : "")).join("");
      return text.split("\n").map((s) => s.trim());
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return [];
}

const raw = await (await fetch(LIST)).text();
const words = [];
const seen = new Set();
for (const line of raw.split("\n")) {
  const w = key(line.split(" ")[0] || "");
  // Letters (and in-word apostrophes/hyphens) only; single letters only if they are words.
  if (!w || seen.has(w) || !/^[\p{L}][\p{L}'’-]*$/u.test(w)) continue;
  if (w.length === 1 && !/^[aàyô]$/.test(w)) continue;
  seen.add(w);
  words.push(w);
  if (words.length >= COUNT) break;
}

const out = {};
let echoed = 0;
for (let i = 0; i < words.length; i += BATCH) {
  const batch = words.slice(i, i + BATCH);
  let got = await translateBatch(batch);
  if (got.length !== batch.length) {
    // Lines merged: translate this batch in small pieces instead.
    got = [];
    for (let j = 0; j < batch.length; j += 10) {
      const part = batch.slice(j, j + 10);
      const r = await translateBatch(part);
      got.push(...(r.length === part.length ? r : part.map(() => "")));
    }
  }
  batch.forEach((w, j) => {
    const t = (got[j] || "").trim();
    if (!t || flat(t) === flat(w)) { echoed++; return; } // no meaning is better than the word again
    out[w] = t;
  });
  if ((i / BATCH) % 20 === 0) process.stdout.write(`\r${Math.min(i + BATCH, words.length)} / ${words.length}`);
}

mkdirSync("public/dict", { recursive: true });
const file = `public/dict/${from}-${to}.v1.json`;
writeFileSync(file, JSON.stringify({
  v: 1, from, to,
  source: "Words: hermitdave/FrequencyWords (OpenSubtitles 2018, CC BY-SA 4.0). Meanings: Google Translate.",
  built: new Date().toISOString().slice(0, 10),
  words: out,
}));
console.log(`\nWrote ${file}: ${Object.keys(out).length} words (${echoed} skipped: no meaning)`);
