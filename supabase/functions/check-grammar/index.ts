// Grades a learner-built sentence with LanguageTool (https://languagetool.org),
// returning the exact offset/length of whatever's wrong so the UI can
// underline the precise word instead of just flashing "incorrect".
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// App language codes (src/lib/languages.ts) -> LanguageTool locale codes.
// Languages LanguageTool doesn't meaningfully cover (zh, ja, ko, ar, hi) are
// left out on purpose — the client falls back to a positional word check
// for those instead of pretending LanguageTool graded them.
const LANGUAGETOOL_LANG: Record<string, string> = {
  en: "en-US",
  es: "es",
  fr: "fr",
  de: "de-DE",
  it: "it",
  pt: "pt-PT",
  nl: "nl",
  pl: "pl",
  ru: "ru",
  sv: "sv",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let text: string, language: string;
  try {
    const body = await req.json();
    text = String(body.text || "").trim();
    language = String(body.language || "").trim();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!text || !language) {
    return json({ error: "Missing text or language" }, 400);
  }

  const ltLang = LANGUAGETOOL_LANG[language];
  if (!ltLang) {
    // Not a language LanguageTool covers well — tell the caller so it can
    // fall back to its own check instead of trusting an empty match list.
    return json({ ok: true, supported: false, matches: [] });
  }

  try {
    const params = new URLSearchParams({ text, language: ltLang });
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`LanguageTool responded ${res.status}`);
    const data = await res.json();

    const matches = Array.isArray(data?.matches)
      ? data.matches
          .filter((m: any) => typeof m?.offset === "number" && typeof m?.length === "number")
          .map((m: any) => ({
            offset: m.offset,
            length: m.length,
            message: String(m.message || ""),
            shortMessage: String(m.shortMessage || m.message || "Grammar issue"),
          }))
      : [];

    return json({ ok: true, supported: true, matches });
  } catch (err) {
    console.error("[check-grammar] LanguageTool lookup failed:", err);
    // Degrade to "couldn't verify" rather than a hard error — the caller
    // falls back to its own positional check.
    return json({ ok: false, supported: false, matches: [] });
  }
});
