// Word-form analysis: surface form -> lemma + exact grammatical form.
// Reads the shared word_forms dictionary first (UniMorph imports + earlier AI
// answers); only words it has never seen go to the AI, and every answer is
// stored for good — a word's morphology doesn't depend on who asked.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const API_KEY = Deno.env.get("LOVABLE_API_KEY");

const nullable = (values: string[]) => ({ type: ["string", "null"], enum: [...values, null] });
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["surface", "lemma", "pos", "form", "person", "number", "tense", "mood"],
        properties: {
          surface: { type: "string" },
          lemma: { type: "string" },
          pos: { type: "string", enum: ["verb", "noun", "adj", "adv", "pron", "det", "prep", "conj", "interj", "num", "other"] },
          form: nullable(["infinitive", "gerund", "participle", "conjugated"]),
          person: nullable(["1", "2", "3"]),
          number: nullable(["sg", "pl"]),
          tense: nullable(["present", "past", "imperfect", "future", "conditional"]),
          mood: nullable(["indicative", "subjunctive", "imperative"]),
        },
      },
    },
  },
};

async function askAi(language: string, words: string[]) {
  const prompt = `You are a morphology analyser for the language with ISO code "${language}".
For each word below give its dictionary lemma, part of speech and, ONLY for verbs, its exact form.
Rules: infinitive with an attached pronoun (e.g. Spanish "ayudarme") is still "infinitive", lemma "ayudar". Gerund = -ando/-iendo/-ant forms. Participle = past participle. Anything finite is "conjugated" with person, number, tense, mood. Non-verbs: form/person/tense/mood = null. Irregular forms must be analysed correctly (e.g. "mantuvo" -> mantener, conjugated, 3 sg past indicative).
Words: ${JSON.stringify(words)}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": API_KEY!, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: [{ role: "user", content: prompt }],
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "word_forms", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`AI ${res.status}: ${detail.slice(0, 300)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
      } catch { /* partial */ }
    }
  }
  const parsed = JSON.parse(text || "{}");
  return (parsed.items ?? []) as Record<string, string | null>[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { language, words } = await req.json();
    if (!language || !Array.isArray(words)) return json({ error: "language and words[] are required" }, 400);
    const surfaces = [...new Set(words.map((w: string) => String(w).trim().toLowerCase()).filter(Boolean))].slice(0, 60);
    if (!surfaces.length) return json({ forms: [] });

    const { data: known } = await supabase.from("word_forms").select("*").eq("language", language).in("surface", surfaces);
    const have = new Map((known ?? []).map((r: any) => [r.surface, r]));
    const missing = surfaces.filter((s) => !have.has(s));

    if (missing.length) {
      if (!API_KEY) return json({ error: "AI not configured", forms: [...have.values()] }, 500);
      const items = await askAi(language, missing);
      const rows = items
        .filter((i) => i.surface && i.lemma && i.pos && missing.includes(String(i.surface).toLowerCase()))
        .map((i) => ({
          language,
          surface: String(i.surface).toLowerCase(),
          lemma: String(i.lemma).toLowerCase(),
          pos: i.pos,
          form: i.pos === "verb" ? i.form : null,
          person: i.person, number: i.number, tense: i.tense, mood: i.mood,
          source: "ai",
        }));
      if (rows.length) {
        const { data: inserted, error } = await supabase
          .from("word_forms").upsert(rows, { onConflict: "language,surface", ignoreDuplicates: false }).select("*");
        if (error) console.error("word_forms upsert failed", error);
        for (const r of inserted ?? []) have.set((r as any).surface, r);
      }
    }
    return json({ forms: [...have.values()] });
  } catch (e) {
    const status = (e as any)?.status;
    console.error("analyze-word-form error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, status === 402 || status === 429 || status === 403 ? status : 500);
  }
});
