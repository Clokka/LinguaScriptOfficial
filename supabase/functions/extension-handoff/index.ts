import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Lets linguascript.co.uk sign in to the same account as the Chrome extension.
 * The extension calls this with its own access token and gets back a one-time
 * magic-link token hash for that verified user (never a client-supplied email),
 * which the site redeems with verifyOtp for a session of its own. Nothing is
 * emailed. The site must not reuse the extension's refresh token: Supabase
 * rotates those, and two holders would trip reuse detection and sign out both.
 */
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing auth" }, 401);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user?.email) return json({ error: "Invalid session" }, 401);

    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) return json({ error: error?.message ?? "Could not create sign-in link" }, 500);

    return json({ token_hash: tokenHash, user_id: user.id, email: user.email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
