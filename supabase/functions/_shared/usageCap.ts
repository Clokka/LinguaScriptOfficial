// Daily call caps for functions that cost money per call (AI, translation,
// text-to-speech). Without them, anyone with the site's public key could call
// these in a loop and burn through the AI credits.
//
// Signed-in learners are counted per account. Guests (and speak-word, which
// is always called with the public key) are counted per IP address, stored
// only as a SHA-256 hash. Calls from our own server functions are never capped.
//
// Change the numbers here — they're the only place caps live.
import { createClient } from "npm:@supabase/supabase-js@2";

export const DAILY_CAPS: Record<string, { user: number; guest: number }> = {
  "translate-word": { user: 1500, guest: 500 },
  "translate-subtitles": { user: 200, guest: 60 },
  // Always called with the public key, so this is per IP. Kept high because a
  // whole school can share one IP address.
  "speak-word": { user: 3000, guest: 3000 },
  "evaluate-linguascripts": { user: 300, guest: 60 },
  "generate-linguascript": { user: 100, guest: 20 },
  "generate-personalized-linguascript": { user: 100, guest: 20 },
};

let _service: ReturnType<typeof createClient> | null = null;
function service() {
  if (!_service) {
    _service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }
  return _service;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Returns a 429 Response when the caller is over today's cap, otherwise null
 * (and counts this call). Fails open: if the counter can't be reached, the
 * call goes ahead rather than breaking the app.
 */
export async function enforceDailyCap(
  req: Request,
  functionName: keyof typeof DAILY_CAPS,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  try {
    const caps = DAILY_CAPS[functionName];
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (token && serviceKey && token === serviceKey) return null;

    let callerKey: string | null = null;
    let cap = caps.guest;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (token && token !== anonKey) {
      const { data } = await service().auth.getUser(token);
      if (data?.user) {
        callerKey = `u:${data.user.id}`;
        cap = caps.user;
      }
    }
    if (!callerKey) callerKey = `ip:${await sha256Hex(clientIp(req))}`;

    const { data: allowed, error } = await service().rpc("bump_function_usage", {
      _caller_key: callerKey,
      _function_name: functionName,
      _daily_cap: cap,
    });
    if (error) {
      console.error(`usage cap check failed for ${functionName} (allowing call):`, error.message);
      return null;
    }
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "daily_limit", message: "Daily limit reached. Please try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return null;
  } catch (e) {
    console.error(`usage cap check crashed for ${functionName} (allowing call):`, e);
    return null;
  }
}
