// Fill public.word_dictionary with the 10,000 most common words of a language,
// translated once with Google, so word taps and flashcards need no translator.
//
// Admin only. Call it again with `next` until `done` (the Admin page does this):
//   POST { language: "fr", target: "en", offset: 0 } → { done, next, total, added }
//
// Frequency lists: github.com/hermitdave/FrequencyWords (OpenSubtitles, CC-BY-SA 4.0).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dictKey, googleTranslateMany, save, serviceDb } from "../_shared/dictionary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TOTAL = 10000;
const CHUNK = 500; // words per call — keeps each call well inside the time limit

// The app's code → the list's folder name.
const LIST: Record<string, string> = { zh: "zh_cn", pt: "pt" };
const listUrls = (lang: string) => {
  const c = LIST[lang] || lang;
  const base = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018";
  return [`${base}/${c}/${c}_50k.txt`, `${base}/${c}/${c}_full.txt`];
};

const cache = new Map<string, string[]>();
async function topWords(lang: string): Promise<string[]> {
  if (cache.has(lang)) return cache.get(lang)!;
  for (const url of listUrls(lang)) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const seen = new Set<string>();
    const words: string[] = [];
    for (const line of (await res.text()).split("\n")) {
      const w = dictKey(line.split(" ")[0] || "");
      // letters only (no numbers, no stray symbols), a sensible length
      if (!w || seen.has(w) || !/^[\p{L}\p{M}'’\-]+$/u.test(w) || w.length > 30) continue;
      seen.add(w);
      words.push(w);
      if (words.length >= TOTAL) break;
    }
    cache.set(lang, words);
    return words;
  }
  throw new Error(`No frequency list for "${lang}"`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Admins only.
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sign in first" }, 401);
    const { data: isAdmin } = await serviceDb().rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const body = await req.json();
    const language = String(body.language || "").toLowerCase();
    const target = String(body.target || "en").toLowerCase();
    const offset = Math.max(0, Number(body.offset) || 0);
    if (!language || language === target) return json({ error: "language (≠ target) is required" }, 400);

    const all = await topWords(language);
    const slice = all.slice(offset, offset + CHUNK);
    const next = offset + slice.length;

    // Skip what's already there (hand-made or looked up before).
    const { data: have } = await serviceDb()
      .from("word_dictionary").select("word").eq("language", language).eq("target", target).in("word", slice);
    const known = new Set((have || []).map((r: { word: string }) => r.word));
    const todo = slice.filter((w) => !known.has(w));

    let added = 0;
    if (todo.length) {
      const translations = await googleTranslateMany(todo, language, target);
      const entries = todo.map((w, i) => ({
        language, word: w, target, translation: translations[i] || "", rank: offset + slice.indexOf(w) + 1, source: "google",
      }));
      await save(entries);
      added = entries.filter((e) => e.translation).length;
    }
    return json({ done: next >= all.length, next, total: all.length, added });
  } catch (e) {
    console.error("seed-dictionary", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
