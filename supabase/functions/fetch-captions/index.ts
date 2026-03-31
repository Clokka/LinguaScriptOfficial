import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Sub { start: number; end: number; text: string }

// ── HTML entity decoder ──
function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#10;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ── Parse YouTube XML (srv3 format) ──
function parseTimedTextXml(xml: string): Sub[] {
  const subs: Sub[] = [];
  const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = textRegex.exec(xml)) !== null) {
    const start = parseFloat(m[1]), dur = parseFloat(m[2]);
    const text = decodeHtml(m[3].replace(/<[^>]+>/g, ''));
    if (text) subs.push({ start, end: start + dur, text });
  }
  if (subs.length > 0) return subs;
  // Alternative: <p t="..." d="...">
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = pRegex.exec(xml)) !== null) {
    const start = parseInt(m[1]) / 1000, dur = parseInt(m[2]) / 1000;
    const text = decodeHtml(m[3].replace(/<[^>]+>/g, ''));
    if (text) subs.push({ start, end: start + dur, text });
  }
  return subs;
}

// ── Parse JSON3 format ──
function parseJson3(json: any): Sub[] {
  const subs: Sub[] = [];
  const events = json?.events || [];
  for (const event of events) {
    if (!event.segs || event.tStartMs === undefined) continue;
    const text = event.segs.map((s: any) => s.utf8 || '').join('').trim();
    if (!text || text === '\n') continue;
    const start = event.tStartMs / 1000;
    const end = (event.tStartMs + (event.dDurationMs || 3000)) / 1000;
    subs.push({ start, end, text: decodeHtml(text) });
  }
  return subs;
}

// ── Strategy 1: InnerTube API (like DownSub) ──
// This is YouTube's internal API — works from server without cookies

async function getInnerTubeCaptionTracks(videoId: string): Promise<any[]> {
  const clients = [
    {
      name: 'WEB',
      payload: {
        context: {
          client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' }
        },
        videoId,
      },
      url: 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    },
    {
      name: 'ANDROID',
      payload: {
        context: {
          client: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30, hl: 'en', gl: 'US' }
        },
        videoId,
      },
      url: 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      headers: { 'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11)' },
    },
  ];

  for (const client of clients) {
    try {
      console.log(`InnerTube ${client.name}: fetching player for ${videoId}...`);
      const res = await fetch(client.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(client.headers || {}),
        },
        body: JSON.stringify(client.payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.log(`InnerTube ${client.name} failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      console.log(`InnerTube ${client.name}: found ${tracks.length} caption tracks`);

      if (tracks.length > 0) return tracks;
    } catch (e) {
      console.log(`InnerTube ${client.name} error: ${e}`);
    }
  }
  return [];
}

async function fetchCaptionFromUrl(url: string, lang: string, useTlang: boolean): Promise<Sub[]> {
  // Try JSON3 format first (most reliable for parsing)
  const formats = ['json3', 'srv3'];

  for (const fmt of formats) {
    try {
      let fetchUrl = url;
      // Add tlang for translation if needed
      if (useTlang) {
        fetchUrl += `&tlang=${lang}`;
      }
      // Set format
      fetchUrl += `&fmt=${fmt}`;

      console.log(`Fetching caption: fmt=${fmt}, tlang=${useTlang ? lang : 'none'}`);
      const res = await fetch(fetchUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      });

      if (!res.ok) {
        console.log(`Caption fetch failed: ${res.status}`);
        continue;
      }

      if (fmt === 'json3') {
        try {
          const json = await res.json();
          const subs = parseJson3(json);
          if (subs.length > 0) {
            console.log(`Parsed ${subs.length} subs via json3`);
            return subs;
          }
        } catch {
          // Not valid JSON, try next format
        }
      } else {
        const content = await res.text();
        if (content.length > 50) {
          const subs = parseTimedTextXml(content);
          if (subs.length > 0) {
            console.log(`Parsed ${subs.length} subs via ${fmt}`);
            return subs;
          }
        }
      }
    } catch (e) {
      console.log(`Format ${fmt} error: ${e}`);
    }
  }
  return [];
}

async function fetchCaptionsViaTlang(videoId: string, learningLang: string, nativeLang: string): Promise<{ learning: Sub[]; native: Sub[] }> {
  const tracks = await getInnerTubeCaptionTracks(videoId);

  if (tracks.length === 0) {
    console.log('No caption tracks found via InnerTube');
    return { learning: [], native: [] };
  }

  // Log available tracks
  for (const t of tracks) {
    console.log(`Track: ${t.languageCode} - ${t.name?.simpleText || t.name?.runs?.[0]?.text || 'unnamed'} (kind: ${t.kind || 'standard'})`);
  }

  // Find best base track — prefer exact match for learning language, then any track
  const exactLearning = tracks.find((t: any) => t.languageCode === learningLang);
  const exactNative = tracks.find((t: any) => t.languageCode === nativeLang);
  const baseTrack = exactLearning || exactNative || tracks[0];

  console.log(`Using base track: ${baseTrack.languageCode}`);
  const baseUrl = baseTrack.baseUrl;

  let learning: Sub[] = [];
  let native: Sub[] = [];

  // Fetch learning language
  if (baseTrack.languageCode === learningLang) {
    // Direct download — no tlang needed
    learning = await fetchCaptionFromUrl(baseUrl, learningLang, false);
  } else {
    // Use tlang to auto-translate
    learning = await fetchCaptionFromUrl(baseUrl, learningLang, true);
  }

  // Fetch native language
  if (baseTrack.languageCode === nativeLang) {
    native = await fetchCaptionFromUrl(baseUrl, nativeLang, false);
  } else if (exactNative) {
    // There's a dedicated track for native language
    native = await fetchCaptionFromUrl(exactNative.baseUrl, nativeLang, false);
  } else {
    // Use tlang to auto-translate
    native = await fetchCaptionFromUrl(baseUrl, nativeLang, true);
  }

  return { learning, native };
}

// ── Fallback: Invidious ──
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://vid.puffyan.us',
];

async function fetchViaInvidious(videoId: string, lang: string): Promise<Sub[]> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const listRes = await fetch(`${instance}/api/v1/captions/${videoId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!listRes.ok) continue;

      const data = await listRes.json();
      const captions = data.captions || [];
      if (captions.length === 0) continue;

      const exact = captions.find((c: any) => c.language_code === lang || c.languageCode === lang);
      let captionUrl = exact?.url || '';

      if (!captionUrl) {
        const base = captions[0];
        const baseUrl = base.url || '';
        if (baseUrl) {
          const sep = baseUrl.includes('?') ? '&' : '?';
          captionUrl = `${baseUrl}${sep}tlang=${lang}`;
        }
      }

      if (!captionUrl) continue;
      const fullUrl = captionUrl.startsWith('http') ? captionUrl : `${instance}${captionUrl}`;

      const captionRes = await fetch(fullUrl, { signal: AbortSignal.timeout(6000) });
      if (!captionRes.ok) continue;

      const content = await captionRes.text();
      const subs = parseTimedTextXml(content);
      if (subs.length > 0) return subs;
    } catch { /* next instance */ }
  }
  return [];
}

// ── Main orchestrator ──

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId, language, nativeLanguage } = await req.json();
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lang = language || 'fr';
    const native = nativeLanguage || 'en';
    console.log(`=== fetch-captions: ${videoId}, learning=${lang}, native=${native} ===`);

    // Strategy 1: InnerTube + tlang (like DownSub)
    let result = await fetchCaptionsViaTlang(videoId, lang, native);

    // Strategy 2: Invidious fallback
    if (!result.learning.length) {
      console.log('InnerTube failed, trying Invidious for learning lang...');
      result.learning = await fetchViaInvidious(videoId, lang);
    }
    if (!result.native.length) {
      console.log('Trying Invidious for native lang...');
      result.native = await fetchViaInvidious(videoId, native);
    }

    console.log(`Final results: learning=${result.learning.length}, native=${result.native.length}`);

    return new Response(JSON.stringify({
      subtitles: result.learning,
      nativeSubtitles: result.native,
      language: lang,
      nativeLanguage: native,
      count: result.learning.length,
      nativeCount: result.native.length,
      source: result.learning.length > 0 ? 'innertube' : 'none',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
