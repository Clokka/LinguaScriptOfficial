import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseXmlSubtitles(xmlText: string): { start: number; end: number; text: string }[] {
  const subtitles: { start: number; end: number; text: string }[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (text) {
      subtitles.push({ start, end: start + dur, text });
    }
  }
  return subtitles;
}

async function scrapeYouTubeCaptions(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  try {
    // Fetch the YouTube watch page
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      console.error('Failed to fetch YouTube page:', res.status);
      return null;
    }

    const html = await res.text();

    // Extract ytInitialPlayerResponse from page HTML
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!playerMatch) {
      console.log('Could not find ytInitialPlayerResponse in page');
      return null;
    }

    let playerData;
    try {
      playerData = JSON.parse(playerMatch[1]);
    } catch (e) {
      console.error('Failed to parse player response JSON');
      return null;
    }

    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      console.log('No caption tracks found in player data');
      return null;
    }

    console.log('Found caption tracks:', captionTracks.map((t: any) => t.languageCode));

    // Find matching language track, or fall back to first available
    let track = captionTracks.find((t: any) => t.languageCode === lang);
    if (!track) {
      // Try partial match (e.g., 'fr' matches 'fr-FR')
      track = captionTracks.find((t: any) => t.languageCode.startsWith(lang));
    }
    if (!track) {
      // Use first available track
      track = captionTracks[0];
      console.log(`No ${lang} track found, using ${track.languageCode}`);
    }

    // Fetch the caption track XML
    let captionUrl = track.baseUrl;
    // Ensure we get srv3 format
    if (!captionUrl.includes('fmt=')) {
      captionUrl += '&fmt=srv3';
    }

    console.log('Fetching caption track:', track.languageCode);
    const captionRes = await fetch(captionUrl);
    if (!captionRes.ok) {
      console.error('Failed to fetch caption track:', captionRes.status);
      return null;
    }

    const xmlText = await captionRes.text();
    const subtitles = parseXmlSubtitles(xmlText);

    if (subtitles.length > 0) {
      return {
        subtitles,
        source: track.kind === 'asr' ? 'auto-generated' : 'manual',
      };
    }

    return null;
  } catch (e) {
    console.error('Scrape error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId, language } = await req.json();
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const lang = language || 'fr';

    // Method 1: Scrape YouTube page for caption track URLs (most reliable)
    console.log(`Attempting page scrape for ${videoId}, lang: ${lang}`);
    const scraped = await scrapeYouTubeCaptions(videoId, lang);
    if (scraped && scraped.subtitles.length > 0) {
      return new Response(JSON.stringify({ subtitles: scraped.subtitles, language: lang, source: scraped.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method 2: Try public timedtext endpoint (fallback)
    console.log('Page scrape failed, trying timedtext API...');
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
    const ttRes = await fetch(timedtextUrl);
    if (ttRes.ok) {
      const xmlText = await ttRes.text();
      const subtitles = parseXmlSubtitles(xmlText);
      if (subtitles.length > 0) {
        return new Response(JSON.stringify({ subtitles, language: lang, source: 'timedtext' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Method 3: Try auto-generated captions
    const asrUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`;
    const asrRes = await fetch(asrUrl);
    if (asrRes.ok) {
      const xmlText = await asrRes.text();
      const subtitles = parseXmlSubtitles(xmlText);
      if (subtitles.length > 0) {
        return new Response(JSON.stringify({ subtitles, language: lang, source: 'auto-generated' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ subtitles: [], language: lang, source: 'none', message: 'No captions found for this video' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
