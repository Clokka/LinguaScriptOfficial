import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface OpenverseResult {
  url: string;
  thumbnail?: string;
  license: string;
  license_version?: string;
  creator?: string;
  foreign_landing_url?: string;
}

/**
 * Text-to-image flashcards: one openly-licensed photo per saved word, sourced
 * from Openverse (Wikimedia's CC-licensed media search — no API key needed).
 * Called once per word and cached on saved_words.image_url by the caller;
 * this function does no caching itself, so a null result is cheap to retry
 * later if Openverse simply had nothing for that query yet.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string' || !query.trim()) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Openverse's own search ranks best on concrete English nouns — a target-
    // language word for an uncommon concept usually has poor coverage, so the
    // caller should pass the learner's own-language gloss when it has one.
    const params = new URLSearchParams({
      q: query.trim(),
      page_size: '1',
      license_type: 'all-cc,commercial,modification',
      mature: 'false',
    });

    const response = await fetch(`https://api.openverse.org/v1/images/?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      // Rate-limited or transient — the caller treats "no image yet" as
      // harmless, so surface it as an empty result rather than an error.
      console.error('Openverse error:', response.status, await response.text());
      return new Response(JSON.stringify({ url: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const hit = data?.results?.[0];
    if (!hit) {
      return new Response(JSON.stringify({ url: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: OpenverseResult = {
      url: hit.thumbnail || hit.url,
      thumbnail: hit.thumbnail,
      license: hit.license,
      license_version: hit.license_version,
      creator: hit.creator,
      foreign_landing_url: hit.foreign_landing_url,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('fetch-word-image error:', error);
    return new Response(JSON.stringify({ url: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
