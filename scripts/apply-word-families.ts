#!/usr/bin/env -S npx tsx
/**
 * Fill core_vocabulary.family / family_rank / family_freq, so every form of a
 * word counts as one word: "manges", "mangeons", "mangé" -> family "manger",
 * ranked by the whole family's frequency.
 *
 * Reads data/<lang>/<lang>-lemmas.tsv (word -> dictionary form) and
 * data/<lang>/<lang>-lemma-frequency.csv (family ranks), both built by
 * scripts/phrases/. Words missing from the table become their own family.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/apply-word-families.ts fr
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const lang = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !lang) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/apply-word-families.ts <lang>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const PAGE = 1000;
const BATCH = 500;

async function main() {
  const familyOf = new Map<string, string>();
  for (const line of readFileSync(`data/${lang}/${lang}-lemmas.tsv`, "utf8").trim().split("\n").slice(1)) {
    const [word, family] = line.split("\t");
    familyOf.set(word, family);
  }
  const familyStats = new Map<string, { rank: number; freq: number }>();
  for (const line of readFileSync(`data/${lang}/${lang}-lemma-frequency.csv`, "utf8").trim().split("\n").slice(1)) {
    // lemma,family_rank,family_freq,forms — lemmas never contain commas.
    const [family, rank, freq] = line.split(",");
    familyStats.set(family, { rank: Number(rank), freq: Number(freq) });
  }

  // Every column the upsert's insert path needs, so it only ever updates.
  type Row = { id: string; language: string; word: string; rank: number; lemma: string };
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("core_vocabulary")
      .select("id, language, word, rank, lemma")
      .eq("language", lang)
      .order("rank")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (!data || data.length < PAGE) break;
  }

  const updates = rows.map((r) => {
    const family = familyOf.get(r.word.toLowerCase()) ?? r.word.toLowerCase();
    const stats = familyStats.get(family);
    return { ...r, family, family_rank: stats?.rank ?? null, family_freq: stats?.freq ?? null };
  });

  for (let i = 0; i < updates.length; i += BATCH) {
    const { error } = await supabase
      .from("core_vocabulary")
      .upsert(updates.slice(i, i + BATCH), { onConflict: "id" });
    if (error) throw error;
  }
  const grouped = updates.filter((u) => u.family !== u.word.toLowerCase()).length;
  console.log(`updated ${updates.length} ${lang} words (${grouped} grouped under another form)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
