import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseXmlSubtitles(xmlText: string): { start: number; end: number; text: string }[] {
  const subtitles: { start: number; end: number; text: string }[] = [];
  const patterns = [
    /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs,
    /<p t="(\d+)" d="(\d+)"[^>]*>(.*?)<\/p>/gs,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(xmlText)) !== null) {
      let start: number, dur: number;
      if (regex === patterns[1]) {
        start = parseInt(match[1]) / 1000;
        dur = parseInt(match[2]) / 1000;
      } else {
        start = parseFloat(match[1]);
        dur = parseFloat(match[2]);
      }
      const text = match[3]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
      if (text) subtitles.push({ start, end: start + dur, text });
    }
    if (subtitles.length > 0) break;
  }
  return subtitles;
}

function parseJsonTranscript(json: any): { start: number; end: number; text: string }[] {
  try {
    const events = json?.events || json;
    if (!Array.isArray(events)) return [];
    const subtitles: { start: number; end: number; text: string }[] = [];
    for (const event of events) {
      if (!event.segs) continue;
      const text = event.segs.map((s: any) => s.utf8).join('').trim();
      if (!text || text === '\n') continue;
      const start = (event.tStartMs || 0) / 1000;
      const dur = (event.dDurationMs || 3000) / 1000;
      subtitles.push({ start, end: start + dur, text });
    }
    return subtitles;
  } catch {
    return [];
  }
}

// Method 1: Fetch YouTube page and extract captions from embedded player data
async function fetchFromPage(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  try {
    // Use embed page which is less restrictive
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    console.log('Embed: fetching', embedUrl);
    
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      console.error('Embed: fetch failed:', res.status);
      await res.text();
      return null;
    }

    const html = await res.text();
    
    // Extract caption tracks from embedded player config
    const captionMatch = html.match(/"captionTracks"\s*:\s*(\[.*?\])\s*,/s);
    if (captionMatch) {
      try {
        const tracks = JSON.parse(captionMatch[1]);
        console.log('Embed: found caption tracks:', tracks.map((t: any) => t.languageCode));
        return await downloadFromTracks(tracks, lang);
      } catch (e) {
        console.error('Embed: failed to parse caption tracks:', e);
      }
    }

    // Try to find in ytInitialPlayerResponse
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*\{/);
    if (playerMatch) {
      const startIdx = playerMatch.index! + playerMatch[0].length - 1;
      const jsonStr = extractBalancedJson(html.substring(startIdx));
      if (jsonStr) {
        try {
          const playerData = JSON.parse(jsonStr);
          const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks?.length) {
            console.log('Embed: found tracks from playerResponse:', tracks.map((t: any) => t.languageCode));
            return await downloadFromTracks(tracks, lang);
          }
        } catch {}
      }
    }

    console.log('Embed: no caption tracks found');
    return null;
  } catch (e) {
    console.error('Embed error:', e);
    return null;
  }
}

function extractBalancedJson(str: string): string | null {
  let depth = 0;
  for (let i = 0; i < Math.min(str.length, 500000); i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return str.substring(0, i + 1);
    }
  }
  return null;
}

async function downloadFromTracks(captionTracks: any[], lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  let track = captionTracks.find((t: any) => t.languageCode === lang)
    || captionTracks.find((t: any) => t.languageCode?.startsWith(lang))
    || captionTracks.find((t: any) => t.languageCode === 'en')
    || captionTracks[0];

  if (!track?.baseUrl) return null;
  
  let captionUrl = track.baseUrl;
  if (!captionUrl.includes('fmt=')) captionUrl += '&fmt=srv3';

  console.log('Downloading captions for', track.languageCode, 'from baseUrl');
  const captionRes = await fetch(captionUrl);
  if (!captionRes.ok) {
    console.error('Caption download failed:', captionRes.status);
    await captionRes.text();
    return null;
  }

  const content = await captionRes.text();
  
  // Try XML parsing
  let subtitles = parseXmlSubtitles(content);
  if (subtitles.length > 0) {
    return { subtitles, source: track.kind === 'asr' ? 'auto-generated' : 'manual' };
  }
  
  // Try JSON parsing (json3 format)
  try {
    const jsonData = JSON.parse(content);
    subtitles = parseJsonTranscript(jsonData);
    if (subtitles.length > 0) {
      return { subtitles, source: track.kind === 'asr' ? 'auto-generated' : 'manual' };
    }
  } catch {}
  
  return null;
}

// Method 2: Direct timedtext endpoints
async function fetchViaTimedtext(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  
  // Try both srv3 (XML) and json3 formats
  const urls = [
    { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`, src: 'timedtext' },
    { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`, src: 'asr' },
    { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`, src: 'json3' },
    { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3&kind=asr`, src: 'json3-asr' },
  ];
  if (lang !== 'en') {
    urls.push(
      { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`, src: 'en' },
      { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3&kind=asr`, src: 'en-asr' },
      { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3&kind=asr`, src: 'en-json3-asr' },
    );
  }
  for (const { url, src } of urls) {
    try {
      console.log('Timedtext:', src);
      const res = await fetch(url, { headers });
      const body = await res.text();
      if (res.ok && body.length > 50) {
        // Try XML
        let subs = parseXmlSubtitles(body);
        if (subs.length > 0) return { subtitles: subs, source: src };
        // Try JSON
        try {
          subs = parseJsonTranscript(JSON.parse(body));
          if (subs.length > 0) return { subtitles: subs, source: src };
        } catch {}
      }
    } catch {}
  }
  return null;
}

// Method 3: YouTube Data API to identify tracks, then download
async function fetchViaYouTubeAPI(videoId: string, lang: string, apiKey: string): Promise<{ subtitles: any[]; source: string } | null> {
  try {
    const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    console.log('YT API: listing captions');
    const listRes = await fetch(listUrl);
    if (!listRes.ok) { await listRes.text(); return null; }

    const listData = await listRes.json();
    const items = listData.items || [];
    console.log('YT API: found', items.length, 'tracks:', items.map((i: any) => `${i.snippet.language} (${i.snippet.trackKind})`));
    if (items.length === 0) return null;

    let track = items.find((i: any) => i.snippet.language === lang)
      || items.find((i: any) => i.snippet.language.startsWith(lang))
      || items.find((i: any) => i.snippet.trackKind !== 'ASR') || items[0];

    const trackLang = track.snippet.language;
    const trackKind = track.snippet.trackKind;

    // Try multiple download formats
    const formats = ['srv3', 'json3'];
    for (const fmt of formats) {
      const ttUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${trackLang}&fmt=${fmt}${trackKind === 'ASR' ? '&kind=asr' : ''}`;
      const ttRes = await fetch(ttUrl);
      const body = await ttRes.text();
      if (ttRes.ok && body.length > 50) {
        let subs = parseXmlSubtitles(body);
        if (subs.length > 0) return { subtitles: subs, source: trackKind === 'ASR' ? 'auto-generated' : 'manual' };
        try {
          subs = parseJsonTranscript(JSON.parse(body));
          if (subs.length > 0) return { subtitles: subs, source: trackKind === 'ASR' ? 'auto-generated' : 'manual' };
        } catch {}
      }
    }
    return null;
  } catch (e) {
    console.error('YT API error:', e);
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

    // Method 1: Embed page scraping (gets signed URLs)
    console.log(`[1/3] Embed page for ${videoId}, lang: ${lang}`);
    const embedResult = await fetchFromPage(videoId, lang);
    if (embedResult && embedResult.subtitles.length > 0) {
      console.log(`✓ Got ${embedResult.subtitles.length} subtitles from embed`);
      return new Response(JSON.stringify({ subtitles: embedResult.subtitles, language: lang, source: embedResult.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method 2: Direct timedtext
    console.log(`[2/3] Timedtext for ${videoId}, lang: ${lang}`);
    const ttResult = await fetchViaTimedtext(videoId, lang);
    if (ttResult && ttResult.subtitles.length > 0) {
      console.log(`✓ Got ${ttResult.subtitles.length} subtitles from timedtext`);
      return new Response(JSON.stringify({ subtitles: ttResult.subtitles, language: lang, source: ttResult.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method 3: YouTube Data API
    if (apiKey) {
      console.log(`[3/3] YouTube API for ${videoId}, lang: ${lang}`);
      const apiResult = await fetchViaYouTubeAPI(videoId, lang, apiKey);
      if (apiResult && apiResult.subtitles.length > 0) {
        console.log(`✓ Got ${apiResult.subtitles.length} subtitles from YT API`);
        return new Response(JSON.stringify({ subtitles: apiResult.subtitles, language: lang, source: apiResult.source }), {
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
