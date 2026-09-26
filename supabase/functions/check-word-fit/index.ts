// Sentence Lab, Step 3: the AI check is the LAST resort, not the first.
// It only runs when simple rules have already confirmed the dropped word is
// the right *kind* of word for the gap (core_vocabulary.pos matched) and the
// only open question is whether its *meaning* actually fits — e.g. "aide"
// and "chien" are both nouns, but only one of them means something after
// "j'ai besoin de ___". Every answer is cached per (pattern, word) forever:
// the fit of a word in a frame doesn't depend on who's asking.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function askAi(language: string, frame: string, after: string, candidate: string): Promise<boolean> {
  const sentence = `${frame} ___${after ? ` ${after}` : ""}`.trim();
  const prompt = `You are grading a language-learning fill-in-the-blank exercise.
Language: ${language}
Sentence with a gap: "${sentence}"
Candidate word to place in the gap: "${candidate}"

Does the candidate word, placed in the gap, produce a sentence that is grammatically sound AND makes real-world sense? Answer with exactly one word: YES or NO.`;

  const response = await fetch(LOVABLE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    console.error("check-word-fit AI error:", response.status, err);
    throw new Error(`AI check failed: ${response.status}`);
  }
  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
  return text.startsWith("Y");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { patternId, language, frame, after, candidate } = await req.json();
    if (!patternId || !language || !frame || !candidate) {
      return new Response(JSON.stringify({ error: "patternId, language, frame and candidate are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const candidateWord = String(candidate).trim().toLowerCase();

    const { data: cached } = await supabase
      .from("sentence_fit_cache" as any)
      .select("fits")
      .eq("pattern_id", patternId)
      .eq("candidate_word", candidateWord)
      .maybeSingle();
    if (cached) {
      return new Response(JSON.stringify({ fits: (cached as any).fits, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fits = await askAi(language, String(frame), String(after ?? ""), candidateWord);

    // Best-effort — a cache write failure shouldn't fail the actual answer.
    const { error: cacheError } = await supabase
      .from("sentence_fit_cache" as any)
      .upsert(
        { pattern_id: patternId, candidate_word: candidateWord, fits },
        { onConflict: "pattern_id,candidate_word" },
      );
    if (cacheError) console.error("check-word-fit cache write failed:", cacheError);

    return new Response(JSON.stringify({ fits, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-word-fit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
