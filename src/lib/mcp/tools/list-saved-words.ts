import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_saved_words",
  title: "List saved words",
  description:
    "List the signed-in user's saved LinguaScript flashcards (words and phrases), optionally filtered by language or SRS state.",
  inputSchema: {
    language: z.string().optional().describe("ISO language code, e.g. 'fr', 'es'."),
    state: z.enum(["red", "orange", "green"]).optional().describe("SRS deck state filter."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ language, state, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = client(ctx)
      .from("saved_words")
      .select("word,translation,language,state,is_phrase,context,next_review,review_count")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (language) q = q.eq("language", language);
    if (state) q = q.eq("state", state);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { words: data ?? [], count: data?.length ?? 0 },
    };
  },
});
