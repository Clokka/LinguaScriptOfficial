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

// Method 1: Use YouTube Data API v3 to get caption tracks, then download via timedtext
async function fetchViaYouTubeAPI(videoId: string, lang: string, apiKey: string): Promise<{ subtitles: any[]; source: string } | null> {
  try {
    // List captions for the video
    const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    console.log('YouTube API: listing captions for', videoId);
    const listRes = await fetch(listUrl, {
      headers: {
        'Referer': 'https://subtitle-mastery.lovable.app',
      },
    });
    
    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error('YouTube API list error:', listRes.status, errText);
      return null;
    }

    const listData = await listRes.json();
    const items = listData.items || [];
    console.log('YouTube API: found', items.length, 'caption tracks:', items.map((i: any) => `${i.snippet.language} (${i.snippet.trackKind})`));

    if (items.length === 0) return null;

    // Find best matching track
    let track = items.find((i: any) => i.snippet.language === lang);
    if (!track) {
      track = items.find((i: any) => i.snippet.language.startsWith(lang));
    }
    if (!track) {
      // Prefer non-ASR tracks
      track = items.find((i: any) => i.snippet.trackKind !== 'ASR') || items[0];
    }

    const trackLang = track.snippet.language;
    const trackKind = track.snippet.trackKind;
    console.log('YouTube API: selected track:', trackLang, trackKind);

    // Download via timedtext endpoint (doesn't require OAuth, works with video captions)
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${trackLang}&fmt=srv3${trackKind === 'ASR' ? '&kind=asr' : ''}`;
    const ttRes = await fetch(timedtextUrl);
    if (ttRes.ok) {
      const xmlText = await ttRes.text();
      const subtitles = parseXmlSubtitles(xmlText);
      if (subtitles.length > 0) {
        return { subtitles, source: trackKind === 'ASR' ? 'auto-generated' : 'manual' };
      }
    }

    return null;
  } catch (e) {
    console.error('YouTube API error:', e);
    return null;
  }
}

// Method 2: Direct timedtext endpoints (no API key needed)
async function fetchViaTimedtext(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // Try manual captions
  const url1 = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
  console.log('Timedtext: trying manual captions for', lang);
  const res1 = await fetch(url1, { headers });
  if (res1.ok) {
    const xml = await res1.text();
    const subs = parseXmlSubtitles(xml);
    if (subs.length > 0) return { subtitles: subs, source: 'timedtext' };
  } else {
    await res1.text(); // consume
  }

  // Try auto-generated
  const url2 = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`;
  console.log('Timedtext: trying ASR captions for', lang);
  const res2 = await fetch(url2, { headers });
  if (res2.ok) {
    const xml = await res2.text();
    const subs = parseXmlSubtitles(xml);
    if (subs.length > 0) return { subtitles: subs, source: 'auto-generated' };
  } else {
    await res2.text();
  }

  // Try English as fallback
  if (lang !== 'en') {
    const url3 = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`;
    console.log('Timedtext: trying English fallback');
    const res3 = await fetch(url3, { headers });
    if (res3.ok) {
      const xml = await res3.text();
      const subs = parseXmlSubtitles(xml);
      if (subs.length > 0) return { subtitles: subs, source: 'timedtext-en-fallback' };
    } else {
      await res3.text();
    }

    const url4 = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3&kind=asr`;
    const res4 = await fetch(url4, { headers });
    if (res4.ok) {
      const xml = await res4.text();
      const subs = parseXmlSubtitles(xml);
      if (subs.length > 0) return { subtitles: subs, source: 'auto-generated-en-fallback' };
    } else {
      await res4.text();
    }
  }

  return null;
}

// Method 3: Scrape YouTube page for caption URLs
async function scrapeYouTubeCaptions(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  try {
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      console.error('Scrape: page fetch failed:', res.status);
      return null;
    }

    const html = await res.text();
    
    // Try multiple patterns to find caption data
    const patterns = [
      /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s,
      /"captions"\s*:\s*(\{.+?\})\s*,\s*"videoDetails"/s,
    ];

    let captionTracks: any[] | null = null;

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks 
            || data?.playerCaptionsTracklistRenderer?.captionTracks;
          if (captionTracks) break;
        } catch {
          continue;
        }
      }
    }

    if (!captionTracks || captionTracks.length === 0) {
      console.log('Scrape: no caption tracks found');
      return null;
    }

    console.log('Scrape: found tracks:', captionTracks.map((t: any) => t.languageCode));

    let track = captionTracks.find((t: any) => t.languageCode === lang)
      || captionTracks.find((t: any) => t.languageCode.startsWith(lang))
      || captionTracks[0];

    let captionUrl = track.baseUrl;
    if (!captionUrl.includes('fmt=')) captionUrl += '&fmt=srv3';

    const captionRes = await fetch(captionUrl);
    if (!captionRes.ok) {
      console.error('Scrape: caption download failed:', captionRes.status);
      return null;
    }

    const xmlText = await captionRes.text();
    const subtitles = parseXmlSubtitles(xmlText);
    if (subtitles.length > 0) {
      return { subtitles, source: track.kind === 'asr' ? 'auto-generated' : 'manual' };
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
      return new Response(JSON.stringify({ error: 'videoId required' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const lang = language || 'fr';
    const apiKey = Deno.env.get('YOUTUBE_API_KEY');

    // Method 1: YouTube Data API (most reliable when API key works)
    if (apiKey) {
      console.log(`[1/3] YouTube API for ${videoId}, lang: ${lang}`);
      const result = await fetchViaYouTubeAPI(videoId, lang, apiKey);
      if (result && result.subtitles.length > 0) {
        return new Response(JSON.stringify({ subtitles: result.subtitles, language: lang, source: result.source }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Method 2: Direct timedtext endpoints
    console.log(`[2/3] Timedtext API for ${videoId}, lang: ${lang}`);
    const ttResult = await fetchViaTimedtext(videoId, lang);
    if (ttResult && ttResult.subtitles.length > 0) {
      return new Response(JSON.stringify({ subtitles: ttResult.subtitles, language: lang, source: ttResult.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method 3: Page scraping
    console.log(`[3/3] Page scrape for ${videoId}, lang: ${lang}`);
    const scrapeResult = await scrapeYouTubeCaptions(videoId, lang);
    if (scrapeResult && scrapeResult.subtitles.length > 0) {
      return new Response(JSON.stringify({ subtitles: scrapeResult.subtitles, language: lang, source: scrapeResult.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ subtitles: [], language: lang, source: 'none', message: 'No captions found for this video' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
