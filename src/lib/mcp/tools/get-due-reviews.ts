import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { displayState, isReviewDue } from "../../../../packages/core/src/review";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// What to quiz the learner on right now: green words whose review is due
// (gold), then words still being learned (red, orange), newest first.
export default defineTool({
  name: "get_due_reviews",
  title: "Words to review now",
  description:
    "Return the signed-in user's flashcards that need practice now: due reviews (gold) first, then words still being learned (red = new, orange = learning). Quiz the learner on these, then call record_review with each answer.",
  inputSchema: {
    language: z.string().optional().describe("ISO language code, e.g. 'fr'."),
    limit: z.number().int().min(1).max(50).optional().describe("Max words (default 15)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ language, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = client(ctx)
      .from("saved_words")
      .select("word,translation,language,state,context,next_review,interval_days,state_changed_at,green_revealed_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (language) q = q.eq("language", language);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const now = Date.now();
    const due = (data ?? []).filter((w) => isReviewDue(w, now));
    const learning = (data ?? []).filter((w) => w.state === "red" || w.state === "orange");
    const words = [...due, ...learning].slice(0, limit ?? 15).map((w) => ({
      word: w.word,
      translation: w.translation,
      language: w.language,
      colour: displayState(w, now),
      context: w.context,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(words, null, 2) }],
      structuredContent: { words, count: words.length },
    };
  },
});
