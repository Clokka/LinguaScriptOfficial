import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseXmlSubtitles(xmlText: string): { start: number; end: number; text: string }[] {
  const subtitles: { start: number; end: number; text: string }[] = [];
  // Handle both <text> and <p> tag formats
  const patterns = [
    /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs,
    /<p t="(\d+)" d="(\d+)"[^>]*>(.*?)<\/p>/gs,
  ];
  
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(xmlText)) !== null) {
      let start: number, dur: number;
      if (regex === patterns[1]) {
        // <p> format uses milliseconds
        start = parseInt(match[1]) / 1000;
        dur = parseInt(match[2]) / 1000;
      } else {
        start = parseFloat(match[1]);
        dur = parseFloat(match[2]);
      }
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
    if (subtitles.length > 0) break;
  }
  return subtitles;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Method 1: Scrape YouTube page for caption URLs (most reliable)
async function scrapeYouTubeCaptions(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  try {
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log('Scrape: fetching page for', videoId);
    
    const res = await fetch(pageUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'Cookie': 'CONSENT=YES+cb; SOCS=CAESEwgDEgk2MjQxMjIwMTQaAmVuIAEaBgiA_d-uBg',
      },
    });

    if (!res.ok) {
      console.error('Scrape: page fetch failed:', res.status);
      return null;
    }

    const html = await res.text();
    
    // Extract ytInitialPlayerResponse
    let playerResponse: any = null;
    
    // Pattern 1: standard assignment
    const p1 = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|const|let|<\/script)/s);
    if (p1) {
      try { playerResponse = JSON.parse(p1[1]); } catch {}
    }
    
    // Pattern 2: within script content - find the JSON more carefully
    if (!playerResponse) {
      const p2 = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?"captions".*?\})\s*;/s);
      if (p2) {
        // Find the balanced JSON
        const jsonStr = extractBalancedJson(p2[1]);
        if (jsonStr) {
          try { playerResponse = JSON.parse(jsonStr); } catch {}
        }
      }
    }

    // Pattern 3: look in embedded player config
    if (!playerResponse) {
      const p3 = html.match(/ytcfg\.set\((\{.*?"PLAYER_VARS".*?\})\)/s);
      if (p3) {
        try {
          const cfg = JSON.parse(p3[1]);
          if (cfg.PLAYER_VARS?.embedded_player_response) {
            playerResponse = JSON.parse(cfg.PLAYER_VARS.embedded_player_response);
          }
        } catch {}
      }
    }

    if (!playerResponse) {
      console.log('Scrape: could not parse player response');
      // Try to find captions directly in HTML
      const captionMatch = html.match(/"captionTracks"\s*:\s*(\[.+?\])/s);
      if (captionMatch) {
        try {
          const tracks = JSON.parse(captionMatch[1]);
          return await downloadFromTracks(tracks, lang);
        } catch {}
      }
      return null;
    }

    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      console.log('Scrape: no caption tracks in player response');
      return null;
    }

    return await downloadFromTracks(captionTracks, lang);
  } catch (e) {
    console.error('Scrape error:', e);
    return null;
  }
}

function extractBalancedJson(str: string): string | null {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return str.substring(0, i + 1);
    }
  }
  return null;
}

async function downloadFromTracks(captionTracks: any[], lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  console.log('Scrape: found tracks:', captionTracks.map((t: any) => `${t.languageCode} (${t.kind || 'manual'})`));

  // Try exact lang match, then prefix, then any track
  let track = captionTracks.find((t: any) => t.languageCode === lang)
    || captionTracks.find((t: any) => t.languageCode.startsWith(lang))
    || captionTracks.find((t: any) => t.languageCode === 'en')
    || captionTracks[0];

  let captionUrl = track.baseUrl;
  if (!captionUrl.includes('fmt=')) captionUrl += '&fmt=srv3';

  console.log('Scrape: downloading from', track.languageCode);
  const captionRes = await fetch(captionUrl, { headers: BROWSER_HEADERS });
  if (!captionRes.ok) {
    console.error('Scrape: caption download failed:', captionRes.status);
    await captionRes.text();
    return null;
  }

  const xmlText = await captionRes.text();
  const subtitles = parseXmlSubtitles(xmlText);
  if (subtitles.length > 0) {
    return { subtitles, source: track.kind === 'asr' ? 'auto-generated' : 'manual' };
  }
  return null;
}

// Method 2: Direct timedtext endpoints
async function fetchViaTimedtext(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  const urls = [
    { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`, src: 'timedtext' },
    { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`, src: 'auto-generated' },
  ];

  if (lang !== 'en') {
    urls.push(
      { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`, src: 'timedtext-en-fallback' },
      { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3&kind=asr`, src: 'auto-generated-en-fallback' },
    );
  }

  for (const { url, src } of urls) {
    try {
      console.log('Timedtext: trying', src);
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (res.ok) {
        const xml = await res.text();
        const subs = parseXmlSubtitles(xml);
        if (subs.length > 0) return { subtitles: subs, source: src };
      } else {
        await res.text();
      }
    } catch {}
  }
  return null;
}

// Method 3: YouTube Data API v3
async function fetchViaYouTubeAPI(videoId: string, lang: string, apiKey: string): Promise<{ subtitles: any[]; source: string } | null> {
  try {
    const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    console.log('YouTube API: listing captions for', videoId);
    const listRes = await fetch(listUrl);
    
    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error('YouTube API list error:', listRes.status, errText);
      return null;
    }

    const listData = await listRes.json();
    const items = listData.items || [];
    console.log('YouTube API: found', items.length, 'caption tracks:', items.map((i: any) => `${i.snippet.language} (${i.snippet.trackKind})`));

    if (items.length === 0) return null;

    let track = items.find((i: any) => i.snippet.language === lang)
      || items.find((i: any) => i.snippet.language.startsWith(lang));
    if (!track) {
      track = items.find((i: any) => i.snippet.trackKind !== 'ASR') || items[0];
    }

    const trackLang = track.snippet.language;
    const trackKind = track.snippet.trackKind;

    // Try downloading via timedtext with the identified language
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${trackLang}&fmt=srv3${trackKind === 'ASR' ? '&kind=asr' : ''}`;
    const ttRes = await fetch(timedtextUrl, { headers: BROWSER_HEADERS });
    if (ttRes.ok) {
      const xmlText = await ttRes.text();
      const subtitles = parseXmlSubtitles(xmlText);
      if (subtitles.length > 0) {
        return { subtitles, source: trackKind === 'ASR' ? 'auto-generated' : 'manual' };
      }
    } else {
      await ttRes.text();
    }

    return null;
  } catch (e) {
    console.error('YouTube API error:', e);
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

    // Method 1: Page scraping (most reliable - gets actual signed URLs)
    console.log(`[1/3] Page scrape for ${videoId}, lang: ${lang}`);
    const scrapeResult = await scrapeYouTubeCaptions(videoId, lang);
    if (scrapeResult && scrapeResult.subtitles.length > 0) {
      return new Response(JSON.stringify({ subtitles: scrapeResult.subtitles, language: lang, source: scrapeResult.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method 2: Direct timedtext endpoints
    console.log(`[2/3] Timedtext API for ${videoId}, lang: ${lang}`);
    const ttResult = await fetchViaTimedtext(videoId, lang);
    if (ttResult && ttResult.subtitles.length > 0) {
      return new Response(JSON.stringify({ subtitles: ttResult.subtitles, language: lang, source: ttResult.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method 3: YouTube Data API
    if (apiKey) {
      console.log(`[3/3] YouTube API for ${videoId}, lang: ${lang}`);
      const result = await fetchViaYouTubeAPI(videoId, lang, apiKey);
      if (result && result.subtitles.length > 0) {
        return new Response(JSON.stringify({ subtitles: result.subtitles, language: lang, source: result.source }), {
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
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
