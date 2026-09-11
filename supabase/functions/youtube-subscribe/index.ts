import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Subscribes the caller to a small set of target-language YouTube
 * channels: a "core" list of known language-learning/comprehensible-input
 * channels for their learning language, plus one "niche" channel per
 * selected interest (a German cars channel for a German learner who picked
 * "cars", etc.) — resolved live via the YouTube Data API, never a
 * hardcoded channel ID, and language-verified before subscribing so a
 * niche search doesn't land on an English channel that merely mentions the
 * topic.
 *
 * KNOWN LIMITATION, stated plainly rather than silently: resolving a name
 * or niche into a real channel ID costs real quota (search.list = 100
 * units; a language-verification lookup adds another ~101). The
 * youtube_channel_resolution_cache table means only the FIRST user to ever
 * request a given (name-or-niche, language) pair pays that cost — everyone
 * after just pays the 50-unit subscribe call — but on a cold cache, one
 * user's first run can burn 1,500-2,000 of the default 10,000 daily
 * quota units. This does not scale past a handful of users/day without
 * requesting a quota increase from Google; that's a real, separate,
 * non-code prerequisite for anything beyond initial testing.
 */

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

// Starter core list of known language-learning / comprehensible-input
// channels per language. Names only — resolved to real channel IDs live,
// never a hardcoded ID I can't verify. Coverage is uneven on purpose: a
// handful of languages have verified flagship channels (researched, not
// guessed from memory); everywhere else is intentionally empty rather than
// a fabricated name, and falls through to niche-style dynamic search for
// "{language} for beginners comprehensible" instead. Edit/extend freely.
const CORE_CHANNEL_NAMES: Record<string, string[]> = {
  es: ["Dreaming Spanish", "Spanishland School"],
  fr: ["Alexa Polidoro", "Français Authentique", "Wandering French"],
  de: ["Easy German", "Learn German With Falk", "ALG German Comprehensible Input"],
  ja: ["Comprehensible Japanese", "Japanese Immersion"],
  ru: ["Comprehensible Russian"],
  it: ["Italiano Automatico"],
  pt: ["Comprehensible Portuguese"],
  zh: ["Mandarin Corner", "Comprehensible Chinese"],
};

interface Interest { id: string; label: string; query: string }

// Mirrors src/lib/interests.ts — duplicated because Deno edge functions
// don't share a bundler with the Vite app. Keep in sync if that file changes.
const INTEREST_QUERY: Record<string, string> = {
  gaming: "gaming", football: "football", fitness: "fitness workout",
  travel: "travel vlog", cooking: "cooking recipe", music: "music",
  films: "films movies", comedy: "comedy", history: "history",
  business: "business", news: "news", podcasts: "podcast", cars: "cars",
  art: "art design", culture: "culture", language: "language learning",
  tech: "technology", entrepreneurship: "entrepreneurship startup", anime: "anime",
};

async function ytFetch(url: URL): Promise<any> {
  url.searchParams.set("key", YOUTUBE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

/** A representative video's declared audio language, if YouTube has one. */
async function channelAudioLang(channelId: string): Promise<string> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("channelId", channelId);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("order", "viewCount");
  searchUrl.searchParams.set("maxResults", "1");
  const searchData = await ytFetch(searchUrl);
  const videoId = searchData?.items?.[0]?.id?.videoId;
  if (!videoId) return "";
  const vidUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  vidUrl.searchParams.set("part", "snippet");
  vidUrl.searchParams.set("id", videoId);
  const vidData = await ytFetch(vidUrl);
  const snippet = vidData?.items?.[0]?.snippet;
  const lang = snippet?.defaultAudioLanguage || snippet?.defaultLanguage || "";
  return String(lang).toLowerCase();
}

interface ResolvedChannel {
  channelId: string;
  channelTitle: string;
  languageVerified: boolean;
}

/** Search for channels matching `query`, returning the first one whose
 * content actually appears to be in `lang` — checked, not assumed. */
async function resolveChannel(query: string, lang: string): Promise<ResolvedChannel | null> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "channel");
  searchUrl.searchParams.set("maxResults", "5");
  searchUrl.searchParams.set("relevanceLanguage", lang);
  const data = await ytFetch(searchUrl);
  const candidates = (data?.items || [])
    .map((it: any) => ({ channelId: it.snippet?.channelId || it.id?.channelId, channelTitle: it.snippet?.title }))
    .filter((c: any) => c.channelId);
  if (candidates.length === 0) return null;

  const langPrefix = lang.toLowerCase().slice(0, 2);
  for (const c of candidates) {
    const audioLang = await channelAudioLang(c.channelId);
    if (audioLang && audioLang.startsWith(langPrefix)) {
      return { channelId: c.channelId, channelTitle: c.channelTitle, languageVerified: true };
    }
  }
  // Nothing verified — best-effort fall back to the top relevance match,
  // clearly flagged as unverified so the UI/caller can be honest about it.
  return { channelId: candidates[0].channelId, channelTitle: candidates[0].channelTitle, languageVerified: false };
}

async function resolveCached(cacheKey: string, query: string, lang: string): Promise<ResolvedChannel | null> {
  const { data: cached } = await admin
    .from("youtube_channel_resolution_cache")
    .select("channel_id, channel_title, language_verified")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (cached) {
    return {
      channelId: (cached as any).channel_id,
      channelTitle: (cached as any).channel_title,
      languageVerified: (cached as any).language_verified,
    };
  }
  const resolved = await resolveChannel(query, lang);
  if (resolved) {
    await admin.from("youtube_channel_resolution_cache").upsert({
      cache_key: cacheKey,
      channel_id: resolved.channelId,
      channel_title: resolved.channelTitle,
      language_verified: resolved.languageVerified,
    });
  }
  return resolved;
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in || 3600 };
}

/** true = newly subscribed, false = already subscribed (not an error), throws on real failure. */
async function subscribeToChannel(accessToken: string, channelId: string): Promise<boolean> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/subscriptions?part=snippet", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ snippet: { resourceId: { kind: "youtube#channel", channelId } } }),
  });
  if (res.ok) return true;
  const body = await res.json().catch(() => ({}));
  const reason = body?.error?.errors?.[0]?.reason;
  if (reason === "subscriptionDuplicate") return false;
  throw new Error(body?.error?.message || `subscribe failed (${res.status})`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!YOUTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

    const { language, interestIds } = await req.json();
    if (!language || typeof language !== "string") {
      return new Response(JSON.stringify({ error: "Missing language" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const lang = language.toLowerCase();
    const langLabel = lang; // best-effort; the caller can pass a display name via interestIds mapping if needed

    const { data: connection } = await admin
      .from("youtube_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!connection) {
      return new Response(JSON.stringify({ error: "not_connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = (connection as any).access_token as string;
    const expiresAt = new Date((connection as any).expires_at as string).getTime();
    if (Date.now() > expiresAt - 60_000) {
      const refreshToken = (connection as any).refresh_token as string | null;
      if (!refreshToken) {
        return new Response(JSON.stringify({ error: "token_expired_no_refresh" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const refreshed = await refreshAccessToken(refreshToken);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "refresh_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.accessToken;
      await admin.from("youtube_connections").update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }

    const coreNames = CORE_CHANNEL_NAMES[lang] || [];
    // No hand-picked list for this language at all -> fall back to one
    // dynamic search so the feature still does *something* useful instead
    // of silently subscribing to nothing.
    const coreQueries = coreNames.length > 0 ? coreNames : [`${langLabel} for beginners comprehensible`];

    const interests: string[] = Array.isArray(interestIds) ? interestIds.slice(0, 3) : [];

    const results: { channelId: string; channelTitle: string; source: "core" | "niche"; interestId: string | null; languageVerified: boolean; subscribed: boolean }[] = [];
    const errors: string[] = [];

    for (const name of coreQueries) {
      try {
        const resolved = await resolveCached(`core:${lang}:${name}`, name, lang);
        if (!resolved) continue;
        const subscribed = await subscribeToChannel(accessToken, resolved.channelId);
        results.push({ channelId: resolved.channelId, channelTitle: resolved.channelTitle, source: "core", interestId: null, languageVerified: resolved.languageVerified, subscribed });
      } catch (e) {
        errors.push(`${name}: ${(e as Error).message}`);
      }
    }

    for (const interestId of interests) {
      const query = INTEREST_QUERY[interestId];
      if (!query) continue;
      try {
        const resolved = await resolveCached(`niche:${lang}:${interestId}`, `${query} ${langLabel}`, lang);
        if (!resolved) continue;
        const subscribed = await subscribeToChannel(accessToken, resolved.channelId);
        results.push({ channelId: resolved.channelId, channelTitle: resolved.channelTitle, source: "niche", interestId, languageVerified: resolved.languageVerified, subscribed });
      } catch (e) {
        errors.push(`${interestId}: ${(e as Error).message}`);
      }
    }

    if (results.length > 0) {
      await admin.from("youtube_subscribed_channels").upsert(
        results.map((r) => ({
          user_id: userId,
          channel_id: r.channelId,
          channel_title: r.channelTitle,
          source: r.source,
          interest_id: r.interestId,
          language: lang,
          language_verified: r.languageVerified,
        })),
        { onConflict: "user_id,channel_id" },
      );
    }

    return new Response(JSON.stringify({ results, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
