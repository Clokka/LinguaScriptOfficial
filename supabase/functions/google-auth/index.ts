import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID =
  "83696703346-d088shcldb678oec73jmh3o5lqjru132.apps.googleusercontent.com";

// Verify a Google ID token using Google's public JWKS
async function verifyGoogleToken(
  idToken: string
): Promise<{ email: string; name?: string; sub: string } | null> {
  try {
    // Fetch Google's public keys
    const jwksRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/certs"
    );
    const jwks: { keys: JsonWebKey[] } = await jwksRes.json();

    // Decode the token header to find which key to use
    const [headerB64, payloadB64, sigB64] = idToken.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const header = JSON.parse(
      atob(headerB64.replace(/-/g, "+").replace(/_/g, "/"))
    );
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    );

    // Basic claim validation
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      console.error("Token audience mismatch", payload.aud);
      return null;
    }
    if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
      console.error("Token issuer mismatch", payload.iss);
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      console.error("Token expired");
      return null;
    }

    // Find the matching key
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      console.error("No matching JWK found for kid:", header.kid);
      return null;
    }

    // Import the public key
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Verify the signature
    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = Uint8Array.from(
      atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      signedData
    );

    if (!valid) {
      console.error("Token signature invalid");
      return null;
    }

    return {
      email: payload.email,
      name: payload.name,
      sub: payload.sub,
    };
  } catch (e) {
    console.error("Token verification error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id_token } = await req.json();
    if (!id_token) {
      return new Response(
        JSON.stringify({ error: "id_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the Google token
    const googleUser = await verifyGoogleToken(id_token);
    if (!googleUser) {
      return new Response(
        JSON.stringify({ error: "Invalid Google token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, name } = googleUser;

    // Create a Supabase admin client (SUPABASE_SERVICE_ROLE_KEY is auto-available)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    if (!existingUser) {
      // Create new user
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: name ?? email.split("@")[0],
          full_name: name,
        },
      });
      if (createError) {
        console.error("Create user error:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate a magic link to get a token_hash the client can use
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (linkError || !linkData) {
      console.error("generateLink error:", linkError);
      return new Response(
        JSON.stringify({ error: linkError?.message ?? "Could not generate session link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract token_hash from the generated link properties
    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) {
      return new Response(
        JSON.stringify({ error: "Could not extract token hash" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ token_hash: tokenHash, email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
