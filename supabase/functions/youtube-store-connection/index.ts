import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Persists the Google provider access/refresh token from a "Connect
 * YouTube" sign-in round trip. Supabase hands these back on the client
 * (session.provider_token / provider_refresh_token) immediately after that
 * specific OAuth redirect, but doesn't store them anywhere itself — this
 * is that storage, keyed by the caller's own verified user id (never a
 * client-supplied one, same pattern as create-checkout's fix earlier).
 */
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { access_token, refresh_token, expires_in, scope } = await req.json();
    if (!access_token) {
      return new Response(JSON.stringify({ error: "Missing access_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + (Number(expires_in) || 3600) * 1000).toISOString();

    // Google only issues a refresh_token on the FIRST consent (or when
    // prompt=consent forces re-issue) — if this round trip didn't include
    // one, keep whatever was stored from a previous connection rather than
    // overwriting it with null and silently breaking future token refresh.
    const { data: existing } = await admin
      .from("youtube_connections")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    const { error: upsertError } = await admin.from("youtube_connections").upsert({
      user_id: userId,
      access_token,
      refresh_token: refresh_token || (existing as any)?.refresh_token || null,
      expires_at: expiresAt,
      scope: scope || null,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) {
      console.error("youtube_connections upsert failed", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
