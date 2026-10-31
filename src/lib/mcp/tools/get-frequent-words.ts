import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// The fastest way into a language: its most frequent words, minus the ones
// the learner has already saved. core_vocabulary is ranked by frequency.
export default defineTool({
  name: "get_frequent_words",
  title: "Next most-frequent words to learn",
  description:
    "Return the most frequent words in a language that the signed-in user has NOT saved yet, in frequency order, with translations. Use this to choose what to teach next — the top words cover most of everyday speech.",
  inputSchema: {
    language: z.string().min(2).describe("ISO language code, e.g. 'fr'. Use get_progress to find the learner's language."),
    limit: z.number().int().min(1).max(50).optional().describe("How many words (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ language, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = client(ctx);
    const want = limit ?? 10;
    const [{ data: vocab, error }, { data: saved }] = await Promise.all([
      sb.from("core_vocabulary").select("word,lemma,translation,rank,pos,cefr_level,example_en")
        .eq("language", language).order("rank", { ascending: true }).limit(1000),
      sb.from("saved_words").select("word,lemma").eq("user_id", ctx.getUserId()!).eq("language", language).limit(10000),
    ]);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const known = new Set<string>();
    for (const w of saved ?? []) {
      if (w.word) known.add(String(w.word).toLowerCase());
      if (w.lemma) known.add(String(w.lemma).toLowerCase());
    }
    const words = (vocab ?? [])
      .filter((v) => !known.has(String(v.word).toLowerCase()) && !known.has(String(v.lemma).toLowerCase()))
      .slice(0, want);
    return {
      content: [{ type: "text", text: JSON.stringify(words, null, 2) }],
      structuredContent: { words, count: words.length },
    };
  },
});
