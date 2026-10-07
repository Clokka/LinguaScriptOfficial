import { aiChat, hasAIKey } from "../_shared/aiChat.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { texts, to } = await req.json();
    if (!Array.isArray(texts) || !texts.length || typeof to !== "string" || !/^[a-z]{2,3}$/.test(to)) {
      return json({ error: "texts[] and to required" }, 400);
    }
    const list = texts.slice(0, 150).map((t) => String(t).slice(0, 400));
    if (!hasAIKey()) return json({ error: "not configured" }, 500);

    const r = await aiChat({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            `You translate user-interface strings of a language-learning app called LinguaScript into the language with ISO code "${to}". ` +
            `Keep it short, friendly and natural for app buttons and labels. Keep emoji, numbers, punctuation and placeholders like {n} unchanged. ` +
            `Never translate the brand names LinguaScript, LinguaScripts, YouTube, Netflix. If a string is not English, return it unchanged. ` +
            `Return JSON {"translations": [...]} with exactly one string per input, same order.`,
        },
        { role: "user", content: JSON.stringify(list) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    if (r.status === 429 || r.status === 402) return json({ error: "rate limited" }, r.status);
    if (!r.ok) return json({ error: "ai error" }, 502);
    const d = await r.json();
    let out: unknown = [];
    try { out = JSON.parse(d.choices?.[0]?.message?.content ?? "{}").translations; } catch { /* ignore */ }
    const translations = Array.isArray(out) && out.length === list.length ? out.map(String) : [];
    return json({ translations });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
