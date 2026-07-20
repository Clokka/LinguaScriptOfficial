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
  name: "get_progress",
  title: "Get learning progress",
  description:
    "Return the signed-in user's LinguaScript profile: learning language, native language, XP, streak, level, and counts of saved words per SRS state.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = client(ctx);
    const uid = ctx.getUserId()!;
    const [{ data: profile }, { data: words }] = await Promise.all([
      sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("saved_words").select("state").eq("user_id", uid),
    ]);
    const counts = { red: 0, orange: 0, green: 0, total: words?.length ?? 0 };
    for (const w of words ?? []) {
      const s = (w as { state?: string }).state;
      if (s === "red" || s === "orange" || s === "green") counts[s]++;
    }
    const result = { profile, saved_word_counts: counts };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
