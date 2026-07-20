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
  name: "list_films",
  title: "Browse LinguaScript content",
  description:
    "List LinguaScript video lessons from the shared catalog, optionally filtered by language, category, or difficulty.",
  inputSchema: {
    language: z.string().optional().describe("ISO language code, e.g. 'fr'."),
    category: z.string().optional().describe("Category slug, e.g. 'travel', 'news'."),
    difficulty: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ language, category, difficulty, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = client(ctx)
      .from("films")
      .select("id,title,language,category,difficulty,youtube_id,description")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (language) q = q.eq("language", language);
    if (category) q = q.eq("category", category);
    if (difficulty) q = q.eq("difficulty", difficulty);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { films: data ?? [], count: data?.length ?? 0 },
    };
  },
});
