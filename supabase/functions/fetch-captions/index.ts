import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

interface Sub { start: number; end: number; text: string }
interface CaptionTrack { lang: string; name?: string; kind?: string }

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSRT(srt: string): Sub[] {
  return srt
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split('\n').filter(Boolean);
      if (lines.length < 3) return null;
      const timeMatch = lines[1]?.match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
      if (!timeMatch) return null;
      const toSec = (t: string) => {
        const [h, m, s] = t.replace(',', '.').split(':');
        return (+h) * 3600 + (+m) * 60 + parseFloat(s);
      };
      return {
        start: toSec(timeMatch[1]),
        end: toSec(timeMatch[2]),
        text: lines.slice(2).join(' ').trim(),
      };
    })
    .filter(Boolean) as Sub[];
}

function parseTimedTextXml(xml: string): Sub[] {
  const subtitles: Sub[] = [];
  const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;

  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, ''));
    if (text) subtitles.push({ start, end: start + dur, text });
  }

  if (subtitles.length > 0) return subtitles;

  while ((match = pRegex.exec(xml)) !== null) {
    const start = parseInt(match[1], 10) / 1000;
    const dur = parseInt(match[2], 10) / 1000;
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, ''));
    if (text) subtitles.push({ start, end: start + dur, text });
  }

  return subtitles;
}

function parseTrackList(xml: string): CaptionTrack[] {
  const tracks: CaptionTrack[] = [];
  const trackRegex = /<track\s+([^>]+?)\/?>(?:<\/track>)?/g;
  const attrRegex = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = trackRegex.exec(xml)) !== null) {
    const attrs = Object.fromEntries(Array.from(match[1].matchAll(attrRegex)).map(([, key, value]) => [key, decodeHtml(value)]));
    const lang = attrs.lang_code || attrs.lang || '';
    if (!lang) continue;
    tracks.push({ lang, name: attrs.name || undefined, kind: attrs.kind || undefined });
  }

  return tracks;
}

function buildTimedTextUrl(videoId: string, track: CaptionTrack, format: 'srt' | 'srv3', targetLang?: string): string {
  const params = new URLSearchParams({ v: videoId, lang: track.lang, fmt: format });
  if (track.name) params.set('name', track.name);
  if (track.kind) params.set('kind', track.kind);
  if (targetLang && targetLang !== track.lang) params.set('tlang', targetLang);
  return `https://video.google.com/timedtext?${params.toString()}`;
}

async function fetchTrackList(videoId: string): Promise<CaptionTrack[]> {
  try {
    const res = await fetch(`https://video.google.com/timedtext?type=list&v=${videoId}`, { headers });
    const body = await res.text();
    return body ? parseTrackList(body) : [];
  } catch {
    return [];
  }
}

async function fetchTrack(videoId: string, lang: string): Promise<Sub[]> {
  const trackList = await fetchTrackList(videoId);
  const directTrack = trackList.find((track) => track.lang === lang) || trackList.find((track) => track.lang.startsWith(`${lang}-`));
  const fallbackTrack = trackList.find((track) => track.lang === 'en') || trackList[0];

  const candidates = [
    directTrack ? { track: directTrack, targetLang: undefined } : null,
    !directTrack && fallbackTrack ? { track: fallbackTrack, targetLang: lang } : null,
  ].filter(Boolean) as Array<{ track: CaptionTrack; targetLang?: string }>;

  for (const candidate of candidates) {
    for (const format of ['srt', 'srv3'] as const) {
      try {
        const url = buildTimedTextUrl(videoId, candidate.track, format, candidate.targetLang);
        console.log(`Trying: ${url}`);
        const res = await fetch(url, { headers });
        const body = await res.text();
        if (!res.ok || !body.trim()) continue;
        const subtitles = format === 'srt' ? parseSRT(body) : parseTimedTextXml(body);
        if (subtitles.length > 0) {
          console.log(`✓ Got ${subtitles.length} subtitles via timedtext (${candidate.track.lang}${candidate.targetLang ? `→${candidate.targetLang}` : ''})`);
          return subtitles;
        }
      } catch {}
    }
  }

  try {
    console.log(`Trying embed page scrape for ${videoId}`);
    const embedRes = await fetch(`https://www.youtube.com/embed/${videoId}`, { headers });
    const html = await embedRes.text();
    const captionMatch = html.match(/"captionTracks"\s*:\s*(\[.*?\])\s*,/s);
    if (captionMatch) {
      const tracks = JSON.parse(captionMatch[1]);
      const direct = tracks.find((track: any) => track.languageCode === lang) || tracks.find((track: any) => track.languageCode?.startsWith(lang));
      const fallback = tracks.find((track: any) => track.languageCode === 'en') || tracks[0];
      const selected = direct || fallback;

      if (selected?.baseUrl) {
        const captionUrl = `${selected.baseUrl}${selected.baseUrl.includes('fmt=') ? '' : '&fmt=srv3'}${!direct && selected.languageCode !== lang ? `&tlang=${encodeURIComponent(lang)}` : ''}`;
        const capRes = await fetch(captionUrl, { headers });
        const xml = await capRes.text();
        const subtitles = parseTimedTextXml(xml);
        if (subtitles.length > 0) {
          console.log(`✓ Got ${subtitles.length} subtitles from embed scrape (${selected.languageCode})`);
          return subtitles;
        }
      }
    }
  } catch (error) {
    console.error('Embed scrape error:', error);
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

    const subtitles = await fetchTrack(videoId, lang);

    return new Response(JSON.stringify({
      subtitles,
      language: lang,
      count: subtitles.length,
      source: subtitles.length > 0 ? 'timedtext' : 'none',
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
