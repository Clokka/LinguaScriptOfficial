#!/usr/bin/env node
// One word pack, every place that taps words. Run after rebuilding a pack with
// scripts/build-instant-dict.mjs:   node scripts/sync-instant-dict.mjs
//   public/dict/<pair>.v1.json                      website player (source of truth)
//   → extension/dict/<pair>.v1.json                 Chrome extension (background.js instantMeaning)
//   → mobile/plugins/process-text/dict/<pair>.tsv   Android bubble card (InstantDict in ProcessTextActivity.kt)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";

mkdirSync("extension/dict", { recursive: true });
mkdirSync("mobile/plugins/process-text/dict", { recursive: true });
for (const f of readdirSync("public/dict").filter((x) => /^[a-z]{2}-[a-z]{2}\.v1\.json$/.test(x))) {
  const pair = f.slice(0, 5);
  copyFileSync(`public/dict/${f}`, `extension/dict/${f}`);
  const words = JSON.parse(readFileSync(`public/dict/${f}`, "utf8")).words || {};
  const tsv = Object.entries(words)
    .map(([w, t]) => `${w}\t${String(t).replace(/[\t\r\n]+/g, " ")}`)
    .join("\n");
  writeFileSync(`mobile/plugins/process-text/dict/${pair}.tsv`, tsv + "\n");
  console.log(`${pair}: ${Object.keys(words).length} words → extension + Android`);
}
