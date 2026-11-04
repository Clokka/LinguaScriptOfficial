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
    "START HERE: call this first in every LinguaScript session. Returns the signed-in user's profile (learning language, native language, level, interests, XP, streak) and counts of saved words per state. Then run a short tutor lesson: quiz due words (get_due_reviews + record_review, one word at a time), teach 2–3 new frequent words in a mini-story about their interests at their level, ask them to use a red word in a sentence, and end with a short summary.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = client(ctx);
    const uid = ctx.getUserId()!;
    const [{ data: profile }, { data: words }] = await Promise.all([
      // profiles.user_id is the auth user (profiles.id is the row's own id).
      sb.from("profiles")
        .select("display_name,learning_language,native_language,learning_goal,interests,cef_level,xp_total,xp_level,streak_count,last_streak_date,daily_word_goal,is_pro")
        .eq("user_id", uid)
        .maybeSingle(),
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
