import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const browserHeaders: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cookie': 'CONSENT=PENDING+987; SOCS=CAESEwgDEgk2MTY0NTkxNTQaAmVuIAEaBgiA_LyuBg',
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
 * Strategy 1: Scrape the YouTube watch page for signed caption URLs.
 * Uses multiple cookie/header combos to bypass EU consent walls.
 */
async function scrapeWatchPage(videoId: string): Promise<any[]> {
  const cookieVariants = [
    'CONSENT=YES+cb; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiADGgYIgMLcrgY',
    'CONSENT=PENDING+987',
    'CONSENT=YES+',
  ];

  for (const cookie of cookieVariants) {
    try {
      const hdrs = { ...browserHeaders, Cookie: cookie };
      console.log(`Trying watch page with cookie: ${cookie.substring(0, 20)}...`);
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { headers: hdrs });
      const html = await res.text();

      if (!html.includes('"captionTracks"')) {
        console.log(`No captionTracks in response (${html.length} bytes)`);
        continue;
      }

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
            console.log(`✓ Found ${tracks.length} caption tracks via watch page scrape`);
            return tracks;
          }
        } catch {}
      }
    } catch (err) {
      console.error('Watch page scrape error:', err);
    }
  }
  return [];
}

/**
 * Strategy 2: YouTube Data API v3 to discover available tracks,
 * then construct timedtext URLs.
 */
async function fetchViaDataApi(videoId: string, targetLang: string): Promise<Sub[]> {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (!apiKey) {
    console.log('No YOUTUBE_API_KEY set, skipping Data API strategy');
    return [];
  }

  try {
    console.log('Trying YouTube Data API v3...');
    const listRes = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&part=snippet&key=${apiKey}`
    );
    const listData = await listRes.json();

    if (!listData.items?.length) {
      console.log('Data API returned no caption tracks');
      return [];
    }

    console.log(`Data API found ${listData.items.length} tracks: ${listData.items.map((i: any) => `${i.snippet.language}(${i.snippet.trackKind})`).join(', ')}`);

    // We know the tracks exist. Try to fetch via timedtext with the known language & kind.
    const directTrack = listData.items.find((i: any) => i.snippet.language === targetLang);
    const fallbackTrack = listData.items.find((i: any) => i.snippet.language === 'en') || listData.items[0];
    const track = directTrack || fallbackTrack;

    if (!track) return [];

    const kind = track.snippet.trackKind === 'asr' ? '&kind=asr' : '';
    const name = track.snippet.name ? `&name=${encodeURIComponent(track.snippet.name)}` : '';
    const tlang = (!directTrack && track.snippet.language !== targetLang) ? `&tlang=${targetLang}` : '';

    // Try multiple timedtext endpoints
    const endpoints = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${track.snippet.language}${kind}${name}&fmt=srv3${tlang}`,
      `https://video.google.com/timedtext?v=${videoId}&lang=${track.snippet.language}${kind}${name}&fmt=srv3${tlang}`,
    ];

    for (const url of endpoints) {
      try {
        console.log(`Fetching timedtext: ${url.substring(0, 120)}...`);
        const res = await fetch(url, { headers: browserHeaders });
        const body = await res.text();
        if (!body.trim() || body.includes('<html>')) continue;
        const subs = parseTimedTextXml(body);
        if (subs.length > 0) {
          console.log(`✓ Got ${subs.length} subtitles via Data API + timedtext`);
          return subs;
        }
      } catch {}
    }
  } catch (err) {
    console.error('Data API error:', err);
  }
  return [];
}

/**
 * Strategy 3: Direct timedtext endpoints (works for some videos)
 */
async function fetchDirectTimedText(videoId: string, lang: string): Promise<Sub[]> {
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`,
    `https://video.google.com/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`,
    `https://video.google.com/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: browserHeaders });
      const body = await res.text();
      if (!body.trim() || body.includes('<html>')) continue;
      const subs = parseTimedTextXml(body);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles from direct timedtext: ${url.substring(0, 80)}...`);
        return subs;
      }
    } catch {}
  }

  // Also try with tlang (auto-translate from en)
  if (lang !== 'en') {
    const tlangUrls = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=srv3&tlang=${lang}`,
      `https://video.google.com/timedtext?v=${videoId}&lang=en&kind=asr&fmt=srv3&tlang=${lang}`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3&tlang=${lang}`,
    ];
    for (const url of tlangUrls) {
      try {
        const res = await fetch(url, { headers: browserHeaders });
        const body = await res.text();
        if (!body.trim() || body.includes('<html>')) continue;
        const subs = parseTimedTextXml(body);
        if (subs.length > 0) {
          console.log(`✓ Got ${subs.length} subtitles via tlang: ${url.substring(0, 80)}...`);
          return subs;
        }
      } catch {}
    }
  }

  return [];
}

/**
 * Download subtitles using signed baseUrl from scraped caption tracks.
 */
async function downloadFromSignedTrack(tracks: any[], targetLang: string): Promise<Sub[]> {
  const directTrack = tracks.find((t: any) => t.languageCode === targetLang) ||
    tracks.find((t: any) => t.languageCode?.startsWith(targetLang));

  if (directTrack?.baseUrl) {
    const url = directTrack.baseUrl.replace(/\\u0026/g, '&');
    const fmtUrl = url.includes('fmt=') ? url : `${url}&fmt=srv3`;
    try {
      const res = await fetch(fmtUrl, { headers: browserHeaders });
      const xml = await res.text();
      const subs = parseTimedTextXml(xml);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles directly in ${directTrack.languageCode}`);
        return subs;
      }
    } catch {}
  }

  // Try translatable track + tlang
  const translatableTrack = tracks.find((t: any) => t.isTranslatable);
  if (translatableTrack?.baseUrl) {
    const url = translatableTrack.baseUrl.replace(/\\u0026/g, '&');
    const fmtUrl = url.includes('fmt=') ? url : `${url}&fmt=srv3`;
    const tlangUrl = `${fmtUrl}&tlang=${encodeURIComponent(targetLang)}`;
    try {
      const res = await fetch(tlangUrl, { headers: browserHeaders });
      const xml = await res.text();
      const subs = parseTimedTextXml(xml);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles via tlang ${translatableTrack.languageCode}→${targetLang}`);
        return subs;
      }
    } catch {}

    // Last resort: source language without translation
    try {
      const res = await fetch(fmtUrl, { headers: browserHeaders });
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

    // Strategy 1: Scrape watch page for signed caption URLs
    const tracks = await scrapeWatchPage(videoId);
    if (tracks.length > 0) {
      const subs = await downloadFromSignedTrack(tracks, lang);
      if (subs.length > 0) {
        return new Response(JSON.stringify({
          subtitles: subs, language: lang, count: subs.length, source: 'watch-scrape',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Strategy 2: Direct timedtext endpoints
    console.log('Trying direct timedtext endpoints...');
    const directSubs = await fetchDirectTimedText(videoId, lang);
    if (directSubs.length > 0) {
      return new Response(JSON.stringify({
        subtitles: directSubs, language: lang, count: directSubs.length, source: 'timedtext-direct',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Strategy 3: YouTube Data API to discover tracks, then fetch
    const apiSubs = await fetchViaDataApi(videoId, lang);
    if (apiSubs.length > 0) {
      return new Response(JSON.stringify({
        subtitles: apiSubs, language: lang, count: apiSubs.length, source: 'data-api',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('No subtitles found from any strategy');
    return new Response(JSON.stringify({
      subtitles: [], language: lang, count: 0, source: 'none',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
