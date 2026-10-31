import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { applySrsReview, coerceDeckState, promote } from "../../../../packages/core/src/review";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Same rule as a flashcard answer on the website (FlashcardReview): a right
// answer moves red → orange → green and up the review ladder; a wrong one
// never moves a word backwards.
export default defineTool({
  name: "record_review",
  title: "Record a review answer",
  description:
    "Record whether the learner got a saved word right (in a quiz, or by using it correctly in their own sentence). Correct answers move the word red → orange → green and schedule its next review; wrong answers keep it where it is.",
  inputSchema: {
    word: z.string().min(1).describe("The saved word, exactly as listed by get_due_reviews or list_saved_words."),
    language: z.string().min(2).describe("ISO language code of the word, e.g. 'fr'."),
    correct: z.boolean().describe("True if the learner knew it / used it correctly."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ word, language, correct }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = client(ctx);
    const uid = ctx.getUserId()!;
    const { data: row, error } = await sb
      .from("saved_words")
      .select("id,state,times_correct,ease_factor,interval_days,review_count")
      .eq("user_id", uid)
      .eq("language", language)
      .ilike("word", word.trim().replace(/[%_\\]/g, "\\$&"))
      .limit(1)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!row) return { content: [{ type: "text", text: `"${word}" isn't in the flashcards yet — use save_word first.` }], isError: true };

    const prev = coerceDeckState(row.state);
    const next = promote(prev, correct);
    const patch: Record<string, unknown> = {
      state: next,
      times_correct: (row.times_correct ?? 0) + (correct ? 1 : 0),
      ...applySrsReview(row, correct, { wasGreen: prev === "green", isGreen: next === "green" }),
    };
    if (next !== prev) patch.state_changed_at = new Date().toISOString();
    const { error: upErr } = await sb.from("saved_words").update(patch).eq("id", row.id).eq("user_id", uid);
    if (upErr) return { content: [{ type: "text", text: upErr.message }], isError: true };
    const result = { word, from: prev, to: next, next_review: patch.next_review };
    return {
      content: [{ type: "text", text: next !== prev ? `${word}: ${prev} → ${next}` : `${word}: stays ${next}` }],
      structuredContent: result,
    };
  },
});
