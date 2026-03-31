import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Sub { start: number; end: number; text: string }

// ── Invidious / Piped instances (rotate if one is down) ──
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://vid.puffyan.us',
  'https://invidious.privacyredirect.com',
  'https://iv.ggtyler.dev',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de',
  'https://api.piped.projectsegfau.lt',
];

// ── Parsers ──

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#10;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parseTimedTextXml(xml: string): Sub[] {
  const subs: Sub[] = [];
  // YouTube srv3 format: <text start="..." dur="...">
  const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = textRegex.exec(xml)) !== null) {
    const start = parseFloat(m[1]), dur = parseFloat(m[2]);
    const text = decodeHtml(m[3].replace(/<[^>]+>/g, ''));
    if (text) subs.push({ start, end: start + dur, text });
  }
  if (subs.length > 0) return subs;
  // Alternative XML format: <p t="..." d="...">
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
    const timeMatch = lines.find(l => l.includes('-->'))?.match(
      /(\d{2}:\d{2}:\d{2}[,.]?\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]?\d{3})/
    );
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

function parseVtt(vtt: string): Sub[] {
  // VTT is very similar to SRT but uses '.' for milliseconds
  return parseSrt(vtt.replace(/^WEBVTT.*\n\n?/i, ''));
}

function parseSubtitleContent(content: string): Sub[] {
  if (content.includes('<text') || content.includes('<p ') || content.includes('<?xml')) {
    const r = parseTimedTextXml(content);
    if (r.length > 0) return r;
  }
  if (content.includes('WEBVTT')) {
    const r = parseVtt(content);
    if (r.length > 0) return r;
  }
  if (content.includes('-->')) {
    const r = parseSrt(content);
    if (r.length > 0) return r;
  }
  return parseTimedTextXml(content);
}

// ── Strategy 1: Invidious API ──

async function fetchViaInvidious(videoId: string, lang: string): Promise<Sub[]> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying Invidious ${instance} for lang=${lang}...`);
      
      // Step 1: List available captions
      const listRes = await fetch(`${instance}/api/v1/captions/${videoId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!listRes.ok) {
        console.log(`Invidious ${instance} list failed: ${listRes.status}`);
        continue;
      }
      
      const data = await listRes.json();
      const captions = data.captions || [];
      console.log(`Invidious ${instance}: ${captions.length} caption tracks`);
      
      if (captions.length === 0) continue;
      
      // Step 2: Find a caption track — prefer exact lang match, otherwise use any track + tlang
      let captionUrl = '';
      
      // Check for exact language match
      const exactMatch = captions.find((c: any) => c.language_code === lang || c.languageCode === lang);
      if (exactMatch) {
        captionUrl = exactMatch.url || '';
        console.log(`Exact caption match for ${lang}`);
      }
      
      // If no exact match, use first track and add tlang for auto-translation
      if (!captionUrl) {
        const baseCaption = captions[0];
        const baseUrl = baseCaption.url || '';
        if (baseUrl) {
          // Add tlang parameter for auto-translation
          const separator = baseUrl.includes('?') ? '&' : '?';
          captionUrl = `${baseUrl}${separator}tlang=${lang}`;
          console.log(`Using base track ${baseCaption.language_code || baseCaption.languageCode} + tlang=${lang}`);
        }
      }
      
      if (!captionUrl) continue;
      
      // Make URL absolute if relative
      const fullUrl = captionUrl.startsWith('http') ? captionUrl : `${instance}${captionUrl}`;
      
      // Step 3: Download the caption content
      const captionRes = await fetch(fullUrl, {
        signal: AbortSignal.timeout(8000),
      });
      if (!captionRes.ok) {
        console.log(`Invidious caption download failed: ${captionRes.status}`);
        continue;
      }
      
      const content = await captionRes.text();
      const subs = parseSubtitleContent(content);
      console.log(`Invidious parsed ${subs.length} subs for ${lang}`);
      if (subs.length > 0) return subs;
    } catch (e) {
      console.log(`Invidious ${instance} error: ${e}`);
    }
  }
  return [];
}

// ── Strategy 2: Piped API ──

async function fetchViaPiped(videoId: string, lang: string): Promise<Sub[]> {
  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`Trying Piped ${instance} for lang=${lang}...`);
      const res = await fetch(`${instance}/streams/${videoId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.log(`Piped ${instance} failed: ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      const subtitles = data.subtitles || [];
      console.log(`Piped ${instance}: ${subtitles.length} subtitle tracks`);
      
      if (subtitles.length === 0) continue;
      
      // Find matching subtitle
      let subUrl = '';
      const exactMatch = subtitles.find((s: any) => 
        s.code === lang || s.code?.startsWith(lang) || s.autoGenerated === false && s.code === lang
      );
      if (exactMatch?.url) {
        subUrl = exactMatch.url;
      }
      
      // If no exact match, try auto-generated
      if (!subUrl) {
        const autoMatch = subtitles.find((s: any) => s.code === lang || s.code?.startsWith(lang));
        if (autoMatch?.url) subUrl = autoMatch.url;
      }
      
      // If still no match, use first track — Piped doesn't support tlang directly,
      // so we just return empty and let the next strategy handle it
      if (!subUrl) {
        console.log(`Piped: no track for ${lang}`);
        continue;
      }
      
      const captionRes = await fetch(subUrl, { signal: AbortSignal.timeout(8000) });
      if (!captionRes.ok) continue;
      
      const content = await captionRes.text();
      const subs = parseSubtitleContent(content);
      console.log(`Piped parsed ${subs.length} subs for ${lang}`);
      if (subs.length > 0) return subs;
    } catch (e) {
      console.log(`Piped ${instance} error: ${e}`);
    }
  }
  return [];
}

// ── Strategy 3: Direct YouTube timedtext (fallback, may get 429) ──

async function fetchViaYouTubeDirect(videoId: string, lang: string): Promise<Sub[]> {
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`,
    `https://video.google.com/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`,
  ];
  
  for (const url of urls) {
    try {
      console.log(`Trying direct timedtext: ${url.substring(0, 80)}...`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        console.log(`Direct timedtext failed: ${res.status}`);
        continue;
      }
      const content = await res.text();
      if (content.length < 50) continue;
      const subs = parseSubtitleContent(content);
      console.log(`Direct timedtext parsed ${subs.length} subs for ${lang}`);
      if (subs.length > 0) return subs;
    } catch (e) {
      console.log(`Direct timedtext error: ${e}`);
    }
  }
  return [];
}

// ── Main orchestrator: try all strategies ──

async function fetchCaptionsForLang(videoId: string, lang: string): Promise<Sub[]> {
  // Strategy 1: Invidious (most reliable)
  let subs = await fetchViaInvidious(videoId, lang);
  if (subs.length > 0) return subs;
  
  // Strategy 2: Piped
  subs = await fetchViaPiped(videoId, lang);
  if (subs.length > 0) return subs;
  
  // Strategy 3: Direct YouTube (may fail due to IP blocks)
  subs = await fetchViaYouTubeDirect(videoId, lang);
  if (subs.length > 0) return subs;
  
  console.log(`All strategies failed for ${videoId} lang=${lang}`);
  return [];
}

async function fetchCaptions(videoId: string, targetLang: string, nativeLang: string): Promise<{ learning: Sub[]; native: Sub[] }> {
  console.log(`Fetching captions: video=${videoId}, learning=${targetLang}, native=${nativeLang}`);
  
  // Fetch both languages sequentially to avoid overwhelming any single instance
  const learning = await fetchCaptionsForLang(videoId, targetLang);
  const native = await fetchCaptionsForLang(videoId, nativeLang);
  
  console.log(`Results: learning=${learning.length}, native=${native.length}`);
  return { learning, native };
}

// ── HTTP handler ──

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
