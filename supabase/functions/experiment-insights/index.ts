import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Admin-only: summarises an A/B test's results per segment with Lovable AI
// and stores the summary on the experiment. Never declares a winner itself —
// the statistics in the admin panel do that.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { key } = await req.json().catch(() => ({}));
    if (typeof key !== "string" || !/^[a-z0-9_]{1,60}$/.test(key)) return json({ error: "Invalid experiment key" }, 400);

    // experiment_results itself rejects non-admins.
    const dims = ["all", "region", "device", "browser_language", "motivation", "source"];
    const results: Record<string, unknown> = {};
    for (const d of dims) {
      const { data, error } = await userClient.rpc("experiment_results", { _key: key, _dimension: d });
      if (error) return json({ error: error.message }, error.message.includes("not_admin") ? 403 : 400);
      results[d] = data;
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You are a growth analyst for LinguaScript, a language-learning app. Summarise this A/B test for a non-technical founder in at most 6 short bullet points. " +
          "Variants: control (method headline), anime, exam. Conversion = signups / views. Say which segments (location, device, language, motivation, source) respond best to which version. " +
          "Be honest about sample size: under 1,000 visitors per version is not enough to call a winner. Suggest one next test. Plain English, no jargon.",
        input: JSON.stringify(results),
      }),
    });
    if (!res.ok || !res.body) {
      const body = await res.text();
      console.error(`AI gateway failed [${res.status}]: ${body}`);
      const msg = res.status === 402 ? "Out of AI credits — top up in Settings → Plans & credits." : res.status === 429 ? "Too many requests, try again shortly." : body;
      return json({ error: msg, status: res.status }, res.status);
    }

    // Read the streamed answer to the end.
    let summary = "";
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.type === "response.output_text.delta") summary += evt.delta;
        } catch { /* keep-alive / [DONE] */ }
      }
    }
    if (!summary.trim()) return json({ error: "The AI returned no summary." }, 502);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("experiments").update({ ai_summary: summary.trim(), updated_at: new Date().toISOString() }).eq("key", key);
    return json({ summary: summary.trim() });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
