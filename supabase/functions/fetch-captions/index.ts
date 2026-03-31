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
  // Format 1: <text start="..." dur="...">
  const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, ''));
    if (text) subtitles.push({ start, end: start + dur, text });
  }
  if (subtitles.length > 0) return subtitles;
  // Format 2: <p t="..." d="...">
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((match = pRegex.exec(xml)) !== null) {
    const start = parseInt(match[1], 10) / 1000;
    const dur = parseInt(match[2], 10) / 1000;
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, ''));
    if (text) subtitles.push({ start, end: start + dur, text });
  }
  return subtitles;
}

function parseSrt(srt: string): Sub[] {
  const subs: Sub[] = [];
  const blocks = srt.replace(/\r\n/g, '\n').trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 3) continue;
    const timeMatch = lines[1]?.match(/(\d{2}:\d{2}:\d{2}[,.]?\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]?\d{3})/);
    if (!timeMatch) continue;
    const toSec = (t: string) => {
      const [h, m, rest] = t.split(':');
      const s = rest.replace(',', '.');
      return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
    };
    const text = lines.slice(2).join(' ').replace(/<[^>]+>/g, '').trim();
    if (text) subs.push({ start: toSec(timeMatch[1]), end: toSec(timeMatch[2]), text });
  }
  return subs;
}

function parseSubtitleContent(content: string): Sub[] {
  // Try XML first, then SRT
  if (content.includes('<text') || content.includes('<p ') || content.includes('<?xml')) {
    const result = parseTimedTextXml(content);
    if (result.length > 0) return result;
  }
  if (content.includes('-->')) {
    const result = parseSrt(content);
    if (result.length > 0) return result;
  }
  // Fallback: try both
  return parseTimedTextXml(content).length > 0 ? parseTimedTextXml(content) : parseSrt(content);
}

/**
 * Extract captionTracks from ytInitialPlayerResponse in page HTML.
 * This is the most reliable method — same as DownSub.
 */
function extractTracksFromHtml(html: string): any[] {
  // Try ytInitialPlayerResponse first
  const patterns = [
    /ytInitialPlayerResponse\s*=\s*(\{.*?\});\s*(?:var\s|<\/script>)/s,
    /ytInitialPlayerResponse\s*=\s*(\{.*?\});/s,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) {
          console.log(`ytInitialPlayerResponse: found ${tracks.length} tracks`);
          return tracks;
        }
      } catch (e) {
        console.log('Failed to parse ytInitialPlayerResponse JSON:', e);
      }
    }
  }

  // Fallback: extract captionTracks array directly
  const captionPatterns = [
    /"captionTracks"\s*:\s*(\[.*?\])\s*,\s*"/s,
    /"captionTracks"\s*:\s*(\[.*?\])\s*,/s,
  ];
  for (const pattern of captionPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const tracks = JSON.parse(match[1]);
        if (Array.isArray(tracks) && tracks.length > 0) {
          console.log(`captionTracks regex: found ${tracks.length} tracks`);
          return tracks;
        }
      } catch {}
    }
  }

  return [];
}

async function downloadTrack(baseUrl: string, lang: string | null, cookies: Record<string, string>): Promise<Sub[]> {
  const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  let url = baseUrl.replace(/\\u0026/g, '&');

  // Add format - try srv3 (XML) which is most reliable
  if (!url.includes('fmt=')) url += '&fmt=srv3';

  // Add translation language if specified
  if (lang) url += `&tlang=${encodeURIComponent(lang)}`;

  try {
    const res = await fetch(url, { headers: { ...browserHeaders, Cookie: cookieStr } });
    if (!res.ok) {
      console.log(`Track download failed: ${res.status}`);
      return [];
    }
    const content = await res.text();
    const subs = parseSubtitleContent(content);
    console.log(`Downloaded track: ${subs.length} subtitles${lang ? ` (tlang=${lang})` : ''}`);
    return subs;
  } catch (e) {
    console.error('Track download error:', e);
    return [];
  }
}

async function fetchCaptions(videoId: string, targetLang: string): Promise<Sub[]> {
  const cookies: Record<string, string> = {};

  const fetchPage = async (): Promise<string> => {
    const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { ...browserHeaders, ...(cookieStr ? { Cookie: cookieStr } : {}) },
      redirect: 'follow',
    });
    return await res.text();
  };

  // Fetch the watch page
  let html = await fetchPage();
  console.log(`Watch page: ${html.length} bytes`);

  // Handle EU consent wall
  if (html.includes('action="https://consent.youtube.com/s"')) {
    const vMatch = html.match(/name="v" value="(.*?)"/);
    cookies['CONSENT'] = vMatch ? 'YES+' + vMatch[1] : 'YES+cb.20210328-17-p0.en+FX+987';
    html = await fetchPage();
    console.log(`After consent: ${html.length} bytes`);
  }

  // Step 1: Extract tracks from ytInitialPlayerResponse (DownSub method)
  let tracks = extractTracksFromHtml(html);

  // Step 2: If no tracks from HTML, try InnerTube API
  if (tracks.length === 0) {
    console.log('No tracks in HTML, trying InnerTube...');
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
    if (apiKeyMatch) {
      const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      try {
        const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKeyMatch[1]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...browserHeaders, Cookie: cookieStr },
          body: JSON.stringify({
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
            videoId,
          }),
        });
        const playerData = await playerRes.json();
        tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        console.log(`InnerTube: found ${tracks.length} tracks`);
      } catch (e) {
        console.log('InnerTube failed:', e);
      }
    }

    // Step 2b: Try TV_EMBEDDED client as another fallback
    if (tracks.length === 0 && apiKeyMatch) {
      try {
        const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKeyMatch[1]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...browserHeaders, Cookie: cookieStr },
          body: JSON.stringify({
            context: { client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' } },
            videoId,
          }),
        });
        const playerData = await playerRes.json();
        tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        console.log(`TV_EMBEDDED: found ${tracks.length} tracks`);
      } catch (e) {
        console.log('TV_EMBEDDED failed:', e);
      }
    }
  }

  if (tracks.length === 0) {
    console.log('No caption tracks found from any method');
    return [];
  }

  console.log(`Available tracks: ${tracks.map((t: any) => `${t.languageCode}${t.kind === 'asr' ? '(auto)' : ''}`).join(', ')}`);

  // Step 3: Find and download the target language track
  // Direct match
  const directTrack = tracks.find((t: any) => t.languageCode === targetLang) ||
    tracks.find((t: any) => t.languageCode?.startsWith(targetLang));

  if (directTrack?.baseUrl) {
    const subs = await downloadTrack(directTrack.baseUrl, null, cookies);
    if (subs.length > 0) {
      console.log(`✓ Direct track ${directTrack.languageCode}: ${subs.length} subs`);
      return subs;
    }
  }

  // Translated track via tlang (DownSub method)
  const translatableTrack = tracks.find((t: any) => t.isTranslatable);
  if (translatableTrack?.baseUrl) {
    const subs = await downloadTrack(translatableTrack.baseUrl, targetLang, cookies);
    if (subs.length > 0) {
      console.log(`✓ Translated ${translatableTrack.languageCode}→${targetLang}: ${subs.length} subs`);
      return subs;
    }
  }

  // Last resort: download any available track
  for (const track of tracks) {
    if (track.baseUrl) {
      const subs = await downloadTrack(track.baseUrl, null, cookies);
      if (subs.length > 0) {
        console.log(`✓ Fallback track ${track.languageCode}: ${subs.length} subs`);
        return subs;
      }
    }
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
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lang = language || 'fr';
    console.log(`=== Fetching captions for ${videoId}, lang: ${lang} ===`);

    const subtitles = await fetchCaptions(videoId, lang);

    return new Response(JSON.stringify({
      subtitles,
      language: lang,
      count: subtitles.length,
      source: subtitles.length > 0 ? 'youtube' : 'none',
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
