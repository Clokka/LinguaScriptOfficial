import { createClient } from "@supabase/supabase-js";
import type { ToolContext, ToolHandlerResult } from "@lovable.dev/mcp-js";
import { hasActivePro } from "../proAccess";

const denied = (text: string): ToolHandlerResult => ({ content: [{ type: "text", text }], isError: true });
// The Pro check used to say the same thing for every failure, which made "why is it not working?"
// impossible to answer. These keep the user-facing text safe, but add a short reason code, and the
// full detail goes to the function log (Supabase dashboard → Edge Functions → mcp → Logs).
const unable = (why: string, detail?: unknown): ToolHandlerResult => {
  console.error("[mcp pro check]", why, detail ?? "");
  return denied(`Unable to check your LinguaScript Pro access (${why}). Please try again later.`);
};

/** All registered tools check the verified caller's current entitlement before any work. */
export function proOnly<T extends { readonly handler: (args: any, ctx: ToolContext) => ToolHandlerResult | Promise<ToolHandlerResult> }>(tool: T): T {
  return {
    ...tool,
    handler: async (args: Parameters<T["handler"]>[0], ctx: ToolContext) => {
      const uid = ctx.getUserId();
      const token = ctx.getToken();
      if (!ctx.isAuthenticated() || !uid || !token) return denied("Sign in to LinguaScript to connect your account.");
      try {
        const runtime = globalThis as typeof globalThis & { Deno?: { env: { get: (key: string) => string | undefined } } };
        const env = (key: string) => runtime.Deno?.env.get(key) ?? (typeof process !== "undefined" ? process.env[key] : undefined);
        const url = env("SUPABASE_URL") ?? import.meta.env.VITE_SUPABASE_URL;
        const key = env("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY") ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return unable("server settings missing");
        const sb = createClient(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await sb.from("profiles").select("is_pro,pro_expires_at").eq("user_id", uid).maybeSingle();
        if (error) return unable(`profile lookup failed: ${error.code ?? "no code"}`, error);
        if (!hasActivePro(data)) return denied("ChatGPT and Claude connections require LinguaScript Pro. Upgrade at linguascript.co.uk/pricing.");
        return await tool.handler(args, ctx);
      } catch (e) {
        return unable(`unexpected error: ${e instanceof Error ? e.name : "unknown"}`, e);
      }
    },
  };
}