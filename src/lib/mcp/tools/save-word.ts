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
  name: "save_word",
  title: "Save a flashcard",
  description:
    "Save a word or phrase to the signed-in user's LinguaScript flashcards. Duplicates for the same word+language are skipped.",
  inputSchema: {
    word: z.string().min(1).describe("The word or phrase to save."),
    language: z.string().min(2).describe("ISO language code of the word, e.g. 'fr'."),
    translation: z.string().optional().describe("Optional translation into the user's native language."),
    context: z.string().optional().describe("Optional sentence the word appeared in."),
    is_phrase: z.boolean().optional().describe("True if saving a full phrase rather than a single word."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ word, language, translation, context, is_phrase }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = client(ctx);
    const uid = ctx.getUserId()!;
    const normalized = word.trim().toLowerCase();

    const { data: existing } = await sb
      .from("saved_words")
      .select("id")
      .eq("user_id", uid)
      .eq("word", normalized)
      .eq("language", language)
      .maybeSingle();
    if (existing) {
      return {
        content: [{ type: "text", text: `Already saved: ${normalized}` }],
        structuredContent: { saved: false, already: true, id: existing.id },
      };
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const { data, error } = await sb
      .from("saved_words")
      .insert({
        user_id: uid,
        word: normalized,
        language,
        translation: translation ?? "",
        context: context ?? "",
        is_phrase: !!is_phrase,
        next_review: yesterday,
        interval_days: 0,
        review_count: 0,
        ease_factor: 2.5,
        state: "red",
      })
      .select("id")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Saved: ${normalized}` }],
      structuredContent: { saved: true, id: data.id },
    };
  },
});
