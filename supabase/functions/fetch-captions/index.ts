import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Sub { start: number; end: number; text: string }

const SUPADATA_API_KEY = Deno.env.get('SUPADATA_API_KEY') || '';

async function fetchSupadataTranscript(videoId: string, lang: string): Promise<Sub[]> {
  const url = new URL('https://api.supadata.ai/v1/transcript');
  url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set('lang', lang);
  url.searchParams.set('text', 'false');
  url.searchParams.set('mode', 'auto');

  console.log(`Supadata: fetching ${videoId} lang=${lang}`);
  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': SUPADATA_API_KEY },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text();
    console.log(`Supadata error ${res.status}: ${body.slice(0, 300)}`);
    throw new Error(`Supadata ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  // Supadata may return a jobId for large videos
  if (data.jobId && !data.content) {
    console.log(`Supadata job queued: ${data.jobId} — polling`);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const jobRes = await fetch(`https://api.supadata.ai/v1/transcript/${data.jobId}`, {
        headers: { 'x-api-key': SUPADATA_API_KEY },
      });
      if (!jobRes.ok) continue;
      const jobData = await jobRes.json();
      if (jobData.status === 'completed' && jobData.content) {
        return mapSupadataContent(jobData.content);
      }
      if (jobData.status === 'failed') {
        throw new Error(`Supadata job failed: ${jobData.error || 'unknown'}`);
      }
    }
    throw new Error('Supadata job timeout');
  }

  return mapSupadataContent(data.content || []);
}

function mapSupadataContent(content: any[]): Sub[] {
  if (!Array.isArray(content)) return [];
  return content
    .map((c) => {
      // offset & duration are in milliseconds per Supadata docs
      const startMs = c.offset ?? c.startMs ?? c.start ?? 0;
      const durMs = c.duration ?? c.durationMs ?? 0;
      const start = startMs / 1000;
      const end = (startMs + durMs) / 1000;
      const text = (c.text || '').trim();
      return { start, end, text };
    })
    .filter((s) => s.text.length > 0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPADATA_API_KEY) {
      throw new Error('SUPADATA_API_KEY not configured');
    }

    const { videoId, language, nativeLanguage } = await req.json();
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lang = language || 'fr';
    const native = nativeLanguage || 'en';
    console.log(`=== fetch-captions: ${videoId}, learning=${lang}, native=${native} ===`);

    let learning: Sub[] = [];
    let nativeSubs: Sub[] = [];
    let learningError: string | null = null;
    let nativeError: string | null = null;

    try {
      learning = await fetchSupadataTranscript(videoId, lang);
    } catch (e: any) {
      learningError = e.message;
      console.log(`Learning lang fetch failed: ${e.message}`);
    }

    if (native !== lang) {
      try {
        nativeSubs = await fetchSupadataTranscript(videoId, native);
      } catch (e: any) {
        nativeError = e.message;
        console.log(`Native lang fetch failed: ${e.message}`);
      }
    } else {
      nativeSubs = learning;
    }

    console.log(`Final: learning=${learning.length}, native=${nativeSubs.length}`);

    return new Response(JSON.stringify({
      subtitles: learning,
      nativeSubtitles: nativeSubs,
      language: lang,
      nativeLanguage: native,
      count: learning.length,
      nativeCount: nativeSubs.length,
      source: 'supadata',
      ...(learningError ? { learningError } : {}),
      ...(nativeError ? { nativeError } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
