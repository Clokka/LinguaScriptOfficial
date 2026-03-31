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
        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
      } catch {}
    }
  }
  const captionPatterns = [
    /"captionTracks"\s*:\s*(\[.*?\])\s*,\s*"/s,
    /"captionTracks"\s*:\s*(\[.*?\])\s*,/s,
  ];
  for (const pattern of captionPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const tracks = JSON.parse(match[1]);
        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
      } catch {}
    }
  }
  return [];
}

async function downloadTrack(baseUrl: string, lang: string | null): Promise<Sub[]> {
  let url = baseUrl.replace(/\\u0026/g, '&');
  if (!url.includes('fmt=')) url += '&fmt=srv3';
  if (lang) url += `&tlang=${encodeURIComponent(lang)}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!res.ok) return [];
    return parseSubtitleContent(await res.text());
  } catch {
    return [];
  }
}

async function fetchCaptions(videoId: string, targetLang: string, nativeLang: string): Promise<{ learning: Sub[]; native: Sub[] }> {
  const cookies: Record<string, string> = {};
  const cookieStr = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

  // Fetch page
  let html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...(cookieStr() ? { Cookie: cookieStr() } : {}) },
    redirect: 'follow',
  }).then(r => r.text());

  // Handle consent
  if (html.includes('action="https://consent.youtube.com/s"')) {
    const vMatch = html.match(/name="v" value="(.*?)"/);
    cookies['CONSENT'] = vMatch ? 'YES+' + vMatch[1] : 'YES+cb.20210328-17-p0.en+FX+987';
    html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': UA, Cookie: cookieStr() },
    }).then(r => r.text());
  }

  let tracks = extractTracksFromHtml(html);
  console.log(`HTML tracks: ${tracks.length}`);

  // InnerTube fallback
  if (tracks.length === 0) {
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
    if (apiKeyMatch) {
      for (const client of [
        { clientName: 'ANDROID', clientVersion: '20.10.38' },
        { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' },
      ]) {
        try {
          const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKeyMatch[1]}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
            body: JSON.stringify({ context: { client }, videoId }),
          });
          const data = await res.json();
          tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          if (tracks.length > 0) break;
        } catch {}
      }
    }
  }

  if (tracks.length === 0) {
    console.log('No caption tracks found');
    return { learning: [], native: [] };
  }

  console.log(`Tracks: ${tracks.map((t: any) => `${t.languageCode}${t.kind === 'asr' ? '(asr)' : ''}`).join(', ')}`);

  // KEY FIX: Pick ONE base track, then use &tlang for both languages
  const baseTrack = tracks.find((t: any) => t.baseUrl && t.kind !== 'asr')
    || tracks.find((t: any) => t.baseUrl);

  if (!baseTrack) {
    console.log('No usable base track');
    return { learning: [], native: [] };
  }

  console.log(`Base track: ${baseTrack.languageCode} → tlang=${targetLang} + tlang=${nativeLang}`);

  // Download both languages in parallel using tlang
  const [learning, native] = await Promise.all([
    downloadTrack(baseTrack.baseUrl, targetLang),
    downloadTrack(baseTrack.baseUrl, nativeLang),
  ]);

  console.log(`Results: learning=${learning.length}, native=${native.length}`);
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
