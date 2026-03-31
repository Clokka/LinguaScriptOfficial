import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface Sub { start: number; end: number; text: string }

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#10;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

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
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = pRegex.exec(xml)) !== null) {
    const start = parseInt(m[1]) / 1000, dur = parseInt(m[2]) / 1000;
    const text = decodeHtml(m[3].replace(/<[^>]+>/g, ''));
    if (text) subs.push({ start, end: start + dur, text });
  }
  return subs;
}

function parseSrt(srt: string): Sub[] {
  const subs: Sub[] = [];
  const blocks = srt.replace(/\r\n/g, '\n').trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;
    const timeMatch = lines.find(l => l.includes('-->'))?.match(/(\d{2}:\d{2}:\d{2}[,.]?\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]?\d{3})/);
    if (!timeMatch) continue;
    const toSec = (t: string) => {
      const [h, m, rest] = t.split(':');
      return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(rest.replace(',', '.'));
    };
    const timeIdx = lines.findIndex(l => l.includes('-->'));
    const text = lines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (text) subs.push({ start: toSec(timeMatch[1]), end: toSec(timeMatch[2]), text });
  }
  return subs;
}

function parseSubtitleContent(content: string): Sub[] {
  if (content.includes('<text') || content.includes('<p ') || content.includes('<?xml')) {
    const r = parseTimedTextXml(content);
    if (r.length > 0) return r;
  }
  if (content.includes('-->')) {
    const r = parseSrt(content);
    if (r.length > 0) return r;
  }
  const xml = parseTimedTextXml(content);
  return xml.length > 0 ? xml : parseSrt(content);
}

function extractTracksFromHtml(html: string): any[] {
  // Check if ytInitialPlayerResponse exists at all
  const hasYtInit = html.includes('ytInitialPlayerResponse');
  const hasCaptionTracks = html.includes('captionTracks');
  console.log(`HTML contains ytInitialPlayerResponse: ${hasYtInit}, captionTracks: ${hasCaptionTracks}`);

  if (hasCaptionTracks) {
    // Try to extract just the captionTracks array directly
    const ctMatch = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/);
    if (ctMatch) {
      try {
        const tracks = JSON.parse(ctMatch[1]);
        if (Array.isArray(tracks) && tracks.length > 0) {
          console.log(`Direct captionTracks extraction: ${tracks.length} tracks`);
          return tracks;
        }
      } catch (e) {
        console.log(`captionTracks parse error: ${e}`);
      }
    }

    // Try broader regex
    const ctMatch2 = html.match(/"captionTracks"\s*:\s*(\[[^\]]*\])/);
    if (ctMatch2) {
      try {
        const tracks = JSON.parse(ctMatch2[1]);
        if (Array.isArray(tracks) && tracks.length > 0) {
          console.log(`Broad captionTracks extraction: ${tracks.length} tracks`);
          return tracks;
        }
      } catch (e) {
        console.log(`Broad captionTracks parse error: ${e}`);
      }
    }
  }

  if (hasYtInit) {
    const patterns = [
      /ytInitialPlayerResponse\s*=\s*(\{.*?\})\s*;\s*var\s/s,
      /ytInitialPlayerResponse\s*=\s*(\{.*?\})\s*;\s*<\/script>/s,
      /ytInitialPlayerResponse\s*=\s*(\{.*?\})\s*;/s,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (Array.isArray(tracks) && tracks.length > 0) {
            console.log(`ytInitialPlayerResponse: ${tracks.length} tracks`);
            return tracks;
          }
          console.log(`ytInitialPlayerResponse parsed but no captionTracks (has captions: ${!!data?.captions})`);
        } catch (e) {
          console.log(`ytInitialPlayerResponse parse failed: ${String(e).substring(0, 100)}`);
        }
      }
    }
  }

  return [];
}

async function downloadTrack(baseUrl: string, lang: string, cookies: Record<string, string>): Promise<Sub[]> {
  let url = baseUrl.replace(/\\u0026/g, '&');
  // Remove existing fmt if present, use srv3 for XML format
  url = url.replace(/&fmt=[^&]*/, '');
  url += `&fmt=srv3&tlang=${encodeURIComponent(lang)}`;

  const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  console.log(`Downloading track for lang=${lang}`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        ...(cookieStr ? { Cookie: cookieStr } : {}),
      },
    });
    if (!res.ok) {
      console.log(`Track download failed: ${res.status}`);
      return [];
    }
    const content = await res.text();
    console.log(`Track content length: ${content.length}`);
    const subs = parseSubtitleContent(content);
    console.log(`Parsed ${subs.length} subs for ${lang}`);
    return subs;
  } catch (e) {
    console.log(`Track download error: ${e}`);
    return [];
  }
}

async function fetchViaInnerTube(videoId: string): Promise<any[]> {
  // Try multiple InnerTube client types
  const clients = [
    {
      clientName: 'WEB',
      clientVersion: '2.20240313.05.00',
      apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    },
    {
      clientName: 'ANDROID',
      clientVersion: '19.09.37',
      apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    },
    {
      clientName: 'IOS',
      clientVersion: '19.09.3',
      apiKey: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
    },
  ];

  for (const client of clients) {
    try {
      console.log(`Trying InnerTube ${client.clientName}...`);
      const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${client.apiKey}&prettyPrint=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': UA,
          'X-YouTube-Client-Name': client.clientName === 'WEB' ? '1' : client.clientName === 'ANDROID' ? '3' : '5',
          'X-YouTube-Client-Version': client.clientVersion,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              hl: 'en',
              gl: 'US',
            },
          },
          videoId,
        }),
      });
      const data = await res.json();
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      console.log(`InnerTube ${client.clientName}: ${tracks.length} tracks, playability: ${data?.playabilityStatus?.status}`);
      if (tracks.length > 0) return tracks;
    } catch (e) {
      console.log(`InnerTube ${client.clientName} error: ${e}`);
    }
  }
  return [];
}

async function fetchCaptions(videoId: string, targetLang: string, nativeLang: string): Promise<{ learning: Sub[]; native: Sub[] }> {
  const cookies: Record<string, string> = {};
  const cookieStr = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

  // Step 1: Fetch YouTube page
  console.log(`Fetching YouTube page for ${videoId}...`);
  let html = '';
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        ...(cookieStr() ? { Cookie: cookieStr() } : {}),
      },
      redirect: 'follow',
    });
    html = await res.text();
    console.log(`Watch page: ${html.length} bytes, status: ${res.status}`);
  } catch (e) {
    console.log(`Page fetch error: ${e}`);
  }

  // Handle consent wall
  if (html.includes('action="https://consent.youtube.com/s"')) {
    console.log('Consent wall detected, setting cookie...');
    const vMatch = html.match(/name="v" value="(.*?)"/);
    cookies['CONSENT'] = vMatch ? 'YES+' + vMatch[1] : 'YES+cb.20210328-17-p0.en+FX+987';
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
        headers: { 'User-Agent': UA, Cookie: cookieStr(), 'Accept-Language': 'en-US,en;q=0.9' },
      });
      html = await res.text();
      console.log(`After consent: ${html.length} bytes`);
    } catch {}
  }

  // Step 2: Try to extract tracks from HTML
  let tracks = extractTracksFromHtml(html);

  // Step 3: If HTML extraction failed, try InnerTube API directly
  if (tracks.length === 0) {
    console.log('HTML extraction failed, trying InnerTube API...');
    tracks = await fetchViaInnerTube(videoId);
  }

  if (tracks.length === 0) {
    console.log('No caption tracks found from any method');
    return { learning: [], native: [] };
  }

  console.log(`Available tracks: ${tracks.map((t: any) => `${t.languageCode}${t.kind === 'asr' ? '(asr)' : ''}`).join(', ')}`);

  // Step 4: Pick ONE base track — prefer non-ASR, but take any
  const baseTrack = tracks.find((t: any) => t.baseUrl && t.kind !== 'asr')
    || tracks.find((t: any) => t.baseUrl);

  if (!baseTrack) {
    console.log('No usable base track with baseUrl');
    return { learning: [], native: [] };
  }

  console.log(`Using base track: ${baseTrack.languageCode} → generating tlang=${targetLang} + tlang=${nativeLang}`);

  // Step 5: Download BOTH languages sequentially (to avoid 429) using &tlang= (DownSub method)
  const learning = await downloadTrack(baseTrack.baseUrl, targetLang, cookies);
  const native = await downloadTrack(baseTrack.baseUrl, nativeLang, cookies);

  console.log(`Results: learning=${learning.length} subs, native=${native.length} subs`);
  return { learning, native };
}

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
    console.log(`=== Fetching captions for ${videoId}, learning: ${lang}, native: ${native} ===`);

    const result = await fetchCaptions(videoId, lang, native);

    return new Response(JSON.stringify({
      subtitles: result.learning,
      nativeSubtitles: result.native,
      language: lang,
      nativeLanguage: native,
      count: result.learning.length,
      nativeCount: result.native.length,
      source: result.learning.length > 0 ? 'youtube' : 'none',
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
