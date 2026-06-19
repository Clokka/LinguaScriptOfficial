// LinguaScript — analyze-comprehension
// Hybrid: YouTube Data API v3 (metadata) + Supadata (transcript).
// Returns: { meta, transcript: { text, language, segments } }
// No scoring is done here — the client computes against the user's vocab.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || "";
const SUPADATA_API_KEY = Deno.env.get("SUPADATA_API_KEY") || "";

interface Sub {
  start: number;
  end: number;
  text: string;
}

function isoDurationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h, mi, s] = m;
  return (parseInt(h || "0") * 3600) + (parseInt(mi || "0") * 60) + parseInt(s || "0");
}

async function fetchYouTubeMeta(videoId: string) {
  if (!YOUTUBE_API_KEY) return null;
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    videoId,
    title: item.snippet?.title ?? null,
    channel: item.snippet?.channelTitle ?? null,
    description: item.snippet?.description ?? null,
    publishedAt: item.snippet?.publishedAt ?? null,
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      null,
    language: item.snippet?.defaultAudioLanguage || item.snippet?.defaultLanguage || null,
    durationSec: isoDurationToSeconds(item.contentDetails?.duration || ""),
  };
}

async function fetchSupadataTranscript(videoId: string, lang: string): Promise<Sub[]> {
  if (!SUPADATA_API_KEY) return [];
  const url = new URL("https://api.supadata.ai/v1/transcript");
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set("lang", lang);
  url.searchParams.set("text", "false");
  url.searchParams.set("mode", "auto");

  let lastBody = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, attempt - 1)));
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": SUPADATA_API_KEY },
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.content || [];
      if (!Array.isArray(content)) return [];
      return content
        .map((c: any) => {
          const startMs = c.offset ?? c.startMs ?? c.start ?? 0;
          const durMs = c.duration ?? c.durationMs ?? 0;
          return {
            start: startMs / 1000,
            end: (startMs + durMs) / 1000,
            text: (c.text || "").trim(),
          };
        })
        .filter((s: Sub) => s.text.length > 0);
    }
    lastStatus = res.status;
    lastBody = await res.text();
    if (res.status !== 429) break;
  }
  throw new Error(`Supadata ${lastStatus}: ${lastBody.slice(0, 200)}`);
}

function getVideoId(input: string): string | null {
  const m = input.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([^&?\s/]+)/,
  );
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{8,15}$/.test(input)) return input;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, videoId: rawVid, language } = await req.json();
    const videoId = rawVid || getVideoId(url || "");
    if (!videoId) {
      return new Response(JSON.stringify({ error: "Invalid YouTube URL or videoId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const lang = (language || "fr").toLowerCase();
    console.log(`[analyze-comprehension] videoId=${videoId} lang=${lang}`);

    const [meta, transcript] = await Promise.all([
      fetchYouTubeMeta(videoId).catch((e) => {
        console.warn("YT meta failed:", e);
        return null;
      }),
      fetchSupadataTranscript(videoId, lang).catch((e) => {
        console.warn("Supadata failed:", e);
        return [] as Sub[];
      }),
    ]);

    const text = transcript.map((s) => s.text).join(" ");

    return new Response(
      JSON.stringify({
        videoId,
        language: lang,
        meta,
        transcript: {
          text,
          segments: transcript,
          segmentCount: transcript.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("analyze-comprehension error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
