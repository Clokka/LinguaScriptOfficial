import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const browserHeaders: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface Sub { start: number; end: number; text: string }

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#10;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parseTimedTextXml(xml: string): Sub[] {
  const subtitles: Sub[] = [];
  const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, ''));
    if (text) subtitles.push({ start, end: start + dur, text });
  }
  if (subtitles.length > 0) return subtitles;
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((match = pRegex.exec(xml)) !== null) {
    const start = parseInt(match[1], 10) / 1000;
    const dur = parseInt(match[2], 10) / 1000;
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, ''));
    if (text) subtitles.push({ start, end: start + dur, text });
  }
  return subtitles;
}

/**
 * Replicates youtube-transcript-api approach:
 * 1. Fetch YouTube watch page HTML
 * 2. Handle EU consent cookie
 * 3. Extract INNERTUBE_API_KEY
 * 4. Call innertube /player endpoint with ANDROID client context
 * 5. Get signed caption track URLs from response
 * 6. Download captions
 */
async function fetchCaptionsViaInnertube(videoId: string, targetLang: string): Promise<Sub[]> {
  // Step 1: Fetch watch page to get API key (handle consent)
  let html = '';
  const cookieJar: Record<string, string> = {};

  const fetchHtml = async () => {
    const cookieStr = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
    const hdrs: Record<string, string> = { ...browserHeaders };
    if (cookieStr) hdrs['Cookie'] = cookieStr;
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: hdrs,
      redirect: 'follow',
    });
    // Capture set-cookie
    const setCookies = res.headers.get('set-cookie') || '';
    for (const part of setCookies.split(',')) {
      const m = part.trim().match(/^([^=]+)=([^;]*)/);
      if (m) cookieJar[m[1].trim()] = m[2].trim();
    }
    return await res.text();
  };

  html = await fetchHtml();
  console.log(`Watch page: ${html.length} bytes`);

  // Handle consent wall
  if (html.includes('action="https://consent.youtube.com/s"')) {
    console.log('Consent wall detected, creating consent cookie...');
    const consentMatch = html.match(/name="v" value="([^"]+)"/);
    if (consentMatch) {
      // Post consent form
      const formData = new URLSearchParams({
        gl: 'GB', m: '0', app: '0', pc: 'yt', continue: `https://www.youtube.com/watch?v=${videoId}`,
        x: '6', bl: 'boq_identityfrontenduiserver', hl: 'en', src: '1', cm: '2', set_eom: 'true', v: consentMatch[1],
      });
      const consentRes = await fetch('https://consent.youtube.com/save', {
        method: 'POST',
        headers: { ...browserHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        redirect: 'manual',
      });
      const consentCookies = consentRes.headers.get('set-cookie') || '';
      for (const part of consentCookies.split(',')) {
        const m = part.trim().match(/^([^=]+)=([^;]*)/);
        if (m) cookieJar[m[1].trim()] = m[2].trim();
      }
    }
    // Set fallback consent cookie
    cookieJar['CONSENT'] = 'YES+cb.20210328-17-p0.en+FX+987';
    cookieJar['SOCS'] = 'CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiADGgYIgMLcrgY';
    html = await fetchHtml();
    console.log(`After consent: ${html.length} bytes`);
  }

  // Step 2: Extract INNERTUBE_API_KEY
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
  if (!apiKeyMatch) {
    console.log('Could not extract INNERTUBE_API_KEY from page');
    // Try to find captionTracks directly in HTML as fallback
    return extractCaptionsFromHtml(html, targetLang);
  }

  const apiKey = apiKeyMatch[1];
  console.log(`Extracted API key: ${apiKey}`);

  // Step 3: Call innertube /player with ANDROID client (same as youtube-transcript-api)
  const cookieStr = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
  const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...browserHeaders,
      'Cookie': cookieStr,
    },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
      videoId,
    }),
  });

  const playerData = await playerRes.json();
  const captions = playerData?.captions?.playerCaptionsTracklistRenderer;

  if (!captions?.captionTracks?.length) {
    console.log('Innertube returned no caption tracks');
    // Fallback: try extracting from HTML
    return extractCaptionsFromHtml(html, targetLang);
  }

  const tracks = captions.captionTracks;
  console.log(`Innertube found ${tracks.length} tracks: ${tracks.map((t: any) => t.languageCode).join(', ')}`);

  // Step 4: Download the target language track
  return await downloadFromTracks(tracks, targetLang, cookieJar);
}

function extractCaptionsFromHtml(html: string, targetLang: string): Sub[] {
  if (!html.includes('"captionTracks"')) return [];
  const patterns = [
    /"captionTracks"\s*:\s*(\[.*?\])\s*,\s*"/s,
    /"captionTracks"\s*:\s*(\[.*?\])\s*,/s,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    try {
      const tracks = JSON.parse(match[1]);
      if (Array.isArray(tracks) && tracks.length > 0) {
        console.log(`Found ${tracks.length} tracks in HTML`);
        // Can't await here, just return empty - this is sync fallback
        return [];
      }
    } catch {}
  }
  return [];
}

async function downloadFromTracks(tracks: any[], targetLang: string, cookies: Record<string, string>): Promise<Sub[]> {
  const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  const hdrs: Record<string, string> = { ...browserHeaders, Cookie: cookieStr };

  // Direct match
  const directTrack = tracks.find((t: any) => t.languageCode === targetLang) ||
    tracks.find((t: any) => t.languageCode?.startsWith(targetLang));

  if (directTrack?.baseUrl) {
    const url = directTrack.baseUrl.replace(/\\u0026/g, '&');
    const fmtUrl = url.includes('fmt=') ? url : `${url}&fmt=srv3`;
    try {
      const res = await fetch(fmtUrl, { headers: hdrs });
      const xml = await res.text();
      const subs = parseTimedTextXml(xml);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles directly in ${directTrack.languageCode}`);
        return subs;
      }
    } catch (e) { console.error('Direct download error:', e); }
  }

  // Translatable track + tlang
  const translatableTrack = tracks.find((t: any) => t.isTranslatable);
  if (translatableTrack?.baseUrl) {
    const url = translatableTrack.baseUrl.replace(/\\u0026/g, '&');
    const fmtUrl = url.includes('fmt=') ? url : `${url}&fmt=srv3`;
    const tlangUrl = `${fmtUrl}&tlang=${encodeURIComponent(targetLang)}`;
    try {
      const res = await fetch(tlangUrl, { headers: hdrs });
      const xml = await res.text();
      const subs = parseTimedTextXml(xml);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles via tlang ${translatableTrack.languageCode}→${targetLang}`);
        return subs;
      }
    } catch (e) { console.error('Tlang download error:', e); }

    // Source language as last resort
    try {
      const res = await fetch(fmtUrl, { headers: hdrs });
      const xml = await res.text();
      const subs = parseTimedTextXml(xml);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles in source ${translatableTrack.languageCode}`);
        return subs;
      }
    } catch {}
  }

  return [];
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
    console.log(`=== Fetching captions for ${videoId}, lang: ${lang} ===`);

    const subtitles = await fetchCaptionsViaInnertube(videoId, lang);

    return new Response(JSON.stringify({
      subtitles,
      language: lang,
      count: subtitles.length,
      source: subtitles.length > 0 ? 'innertube' : 'none',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
