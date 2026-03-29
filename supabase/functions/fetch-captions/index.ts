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

// Method 1: YouTube InnerTube API (what the player uses internally)
async function fetchViaInnerTube(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  try {
    // Try multiple client types
    const clients = [
      {
        name: 'ANDROID',
        body: {
          context: { client: { hl: 'en', gl: 'US', clientName: 'ANDROID', clientVersion: '19.29.37', androidSdkVersion: 30 } },
          videoId,
        },
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/19.29.37 (Linux; U; Android 11)' },
      },
      {
        name: 'TV_EMBEDDED',
        body: {
          context: { client: { hl: 'en', gl: 'US', clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' } },
          videoId,
        },
        headers: { 'Content-Type': 'application/json' },
      },
    ];

    for (const client of clients) {
      console.log(`InnerTube: trying ${client.name} client for`, videoId);
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: client.headers,
        body: JSON.stringify(client.body),
      });

      if (!res.ok) {
        console.error(`InnerTube ${client.name}: request failed:`, res.status);
        await res.text();
        continue;
      }

    const data = await res.json();
    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captionTracks || captionTracks.length === 0) {
      console.log('InnerTube: no caption tracks found');
      return null;
    }

    console.log('InnerTube: found tracks:', captionTracks.map((t: any) => `${t.languageCode} (${t.kind || 'manual'})`));

    // Find best track
    let track = captionTracks.find((t: any) => t.languageCode === lang)
      || captionTracks.find((t: any) => t.languageCode.startsWith(lang))
      || captionTracks.find((t: any) => t.languageCode === 'en')
      || captionTracks[0];

    let captionUrl = track.baseUrl;
    if (!captionUrl.includes('fmt=')) captionUrl += '&fmt=srv3';

    console.log('InnerTube: downloading captions for', track.languageCode);
    const captionRes = await fetch(captionUrl);
    if (!captionRes.ok) {
      console.error('InnerTube: caption download failed:', captionRes.status);
      await captionRes.text();
      return null;
    }

    const xmlText = await captionRes.text();
    const subtitles = parseXmlSubtitles(xmlText);
    if (subtitles.length > 0) {
      return { subtitles, source: track.kind === 'asr' ? 'auto-generated' : 'manual' };
    }
    return null;
  } catch (e) {
    console.error('InnerTube error:', e);
    return null;
  }
}

// Method 2: Direct timedtext endpoints
async function fetchViaTimedtext(videoId: string, lang: string): Promise<{ subtitles: any[]; source: string } | null> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const urls = [
    { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`, src: 'timedtext' },
    { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`, src: 'auto-generated' },
  ];
  if (lang !== 'en') {
    urls.push(
      { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`, src: 'timedtext-en' },
      { url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3&kind=asr`, src: 'auto-generated-en' },
    );
  }
  for (const { url, src } of urls) {
    try {
      console.log('Timedtext: trying', src);
      const res = await fetch(url, { headers });
      const xml = await res.text();
      if (res.ok && xml.length > 50) {
        const subs = parseXmlSubtitles(xml);
        if (subs.length > 0) return { subtitles: subs, source: src };
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
    if (!listRes.ok) { await listRes.text(); return null; }

    const listData = await listRes.json();
    const items = listData.items || [];
    console.log('YouTube API: found', items.length, 'tracks:', items.map((i: any) => `${i.snippet.language} (${i.snippet.trackKind})`));
    if (items.length === 0) return null;

    let track = items.find((i: any) => i.snippet.language === lang)
      || items.find((i: any) => i.snippet.language.startsWith(lang))
      || items.find((i: any) => i.snippet.trackKind !== 'ASR') || items[0];

    const trackLang = track.snippet.language;
    const trackKind = track.snippet.trackKind;

    const ttUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${trackLang}&fmt=srv3${trackKind === 'ASR' ? '&kind=asr' : ''}`;
    const ttRes = await fetch(ttUrl);
    const xml = await ttRes.text();
    if (ttRes.ok && xml.length > 50) {
      const subtitles = parseXmlSubtitles(xml);
      if (subtitles.length > 0) return { subtitles, source: trackKind === 'ASR' ? 'auto-generated' : 'manual' };
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

    // Method 1: InnerTube API (most reliable, gets signed caption URLs)
    console.log(`[1/3] InnerTube for ${videoId}, lang: ${lang}`);
    const innerResult = await fetchViaInnerTube(videoId, lang);
    if (innerResult && innerResult.subtitles.length > 0) {
      return new Response(JSON.stringify({ subtitles: innerResult.subtitles, language: lang, source: innerResult.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method 2: Direct timedtext
    console.log(`[2/3] Timedtext for ${videoId}, lang: ${lang}`);
    const ttResult = await fetchViaTimedtext(videoId, lang);
    if (ttResult && ttResult.subtitles.length > 0) {
      return new Response(JSON.stringify({ subtitles: ttResult.subtitles, language: lang, source: ttResult.source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method 3: YouTube Data API
    if (apiKey) {
      console.log(`[3/3] YouTube API for ${videoId}, lang: ${lang}`);
      const apiResult = await fetchViaYouTubeAPI(videoId, lang, apiKey);
      if (apiResult && apiResult.subtitles.length > 0) {
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
