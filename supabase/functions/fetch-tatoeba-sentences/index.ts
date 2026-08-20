// Three extra example sentences for a saved word, pulled from Tatoeba
// (https://tatoeba.org) and cached in word_example_sentences so a repeat
// lookup for the same word hits Postgres instead of a third-party API.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// App language codes (src/lib/languages.ts) -> Tatoeba's ISO 639-3 codes.
const TATOEBA_LANG: Record<string, string> = {
  en: "eng",
  es: "spa",
  fr: "fra",
  de: "deu",
  it: "ita",
  pt: "por",
  zh: "cmn",
  ja: "jpn",
  ko: "kor",
  ar: "ara",
  hi: "hin",
  ru: "rus",
  tr: "tur",
  nl: "nld",
  pl: "pol",
  sv: "swe",
};

interface CachedSentence {
  sentence: string;
  translation: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let word: string, language: string, nativeLanguage: string;
  try {
    const body = await req.json();
    word = String(body.word || "").trim();
    language = String(body.language || "").trim();
    nativeLanguage = String(body.nativeLanguage || "en").trim();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!word || !language) {
    return json({ error: "Missing word or language" }, 400);
  }

  const fromLang = TATOEBA_LANG[language];
  if (!fromLang) {
    // A language we don't have a Tatoeba code for — not an error, just
    // nothing to show.
    return json({ sentences: [] });
  }
  const toLang = TATOEBA_LANG[nativeLanguage] || "eng";

  const normalizedWord = word.toLowerCase();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Already cached? Serve straight from Postgres, no Tatoeba round trip.
  const { data: cached } = await supabase
    .from("word_example_sentences")
    .select("sentence, translation")
    .eq("word", normalizedWord)
    .eq("language", language)
    .order("created_at", { ascending: true })
    .limit(3);

  if (cached && cached.length >= 3) {
    return json({ sentences: cached as CachedSentence[] });
  }

  try {
    const url = new URL("https://tatoeba.org/eng/api_v0/search");
    url.searchParams.set("from", fromLang);
    url.searchParams.set("to", toLang);
    url.searchParams.set("query", word);
    url.searchParams.set("trans_filter", "limit");
    url.searchParams.set("trans_to", toLang);
    url.searchParams.set("sort", "relevance");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Tatoeba responded ${res.status}`);
    const data = await res.json();

    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    const rows: { sentence: string; translation: string; source_id: string }[] = [];

    for (const r of results) {
      const sentence = typeof r?.text === "string" ? r.text.trim() : "";
      if (!sentence || r?.id == null) continue;

      const translationGroups: any[] = Array.isArray(r?.translations) ? r.translations : [];
      const flat = translationGroups.flat();
      const match = flat.find((t: any) => t?.lang === toLang && typeof t?.text === "string");

      rows.push({
        sentence,
        translation: match?.text?.trim() || "",
        source_id: String(r.id),
      });

      if (rows.length >= 5) break;
    }

    if (rows.length) {
      const { error: upsertError } = await supabase
        .from("word_example_sentences")
        .upsert(
          rows.map((row) => ({
            word: normalizedWord,
            language,
            sentence: row.sentence,
            translation: row.translation,
            source: "tatoeba",
            source_id: row.source_id,
          })),
          { onConflict: "word,language,source,source_id", ignoreDuplicates: true },
        );
      if (upsertError) console.error("[fetch-tatoeba-sentences] cache upsert failed:", upsertError);
    }

    // Merge with whatever was already cached so a partial Tatoeba result
    // still benefits from an earlier lookup.
    const seen = new Set((cached || []).map((c) => c.sentence));
    const merged = [...(cached || [])];
    for (const row of rows) {
      if (merged.length >= 3) break;
      if (seen.has(row.sentence)) continue;
      seen.add(row.sentence);
      merged.push({ sentence: row.sentence, translation: row.translation });
    }

    return json({ sentences: merged.slice(0, 3) });
  } catch (err) {
    console.error("[fetch-tatoeba-sentences] Tatoeba lookup failed:", err);
    // Degrade gracefully — the caller shows "no more sentences" rather than
    // an error state, and still gets whatever was already cached.
    return json({ sentences: (cached || []).slice(0, 3) });
  }
});
