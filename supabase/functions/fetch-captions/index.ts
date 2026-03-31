import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface Sub { start: number; end: number; text: string }

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
      return { start: toSec(timeMatch[1]), end: toSec(timeMatch[2]), text: lines.slice(2).join(' ').trim() };
    })
    .filter(Boolean) as Sub[];
}

/**
 * Scrape the YouTube WATCH page to extract captionTracks with signed URLs.
 * This works much more reliably than the embed page or timedtext list API.
 */
async function scrapeCaptionTracks(videoId: string): Promise<any[]> {
  const urls = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://m.youtube.com/watch?v=${videoId}`,
  ];

  for (const url of urls) {
    try {
      console.log(`Scraping caption tracks from: ${url}`);
      const res = await fetch(url, { headers });
      const html = await res.text();

      // Try to find captionTracks in the page
      const match = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/);
      if (!match) {
        // Try alternate pattern
        const match2 = html.match(/"captionTracks"\s*:\s*(\[.*?\])\s*,/s);
        if (match2) {
          try {
            const tracks = JSON.parse(match2[1]);
            console.log(`Found ${tracks.length} caption tracks from ${url}`);
            return tracks;
          } catch {}
        }
        continue;
      }

      try {
        const tracks = JSON.parse(match[1]);
        console.log(`Found ${tracks.length} caption tracks from ${url}`);
        return tracks;
      } catch {}
    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err);
    }
  }

  return [];
}

/**
 * Download subtitles using the signed baseUrl from captionTracks.
 * Supports tlang for machine translation to target language.
 */
async function downloadFromTrack(
  tracks: any[],
  targetLang: string,
): Promise<{ subtitles: Sub[]; sourceLang: string }> {
  // 1) Try to find a direct track for the target language
  const directTrack = tracks.find((t: any) => t.languageCode === targetLang) ||
    tracks.find((t: any) => t.languageCode?.startsWith(targetLang));

  if (directTrack?.baseUrl) {
    const url = directTrack.baseUrl.replace(/\\u0026/g, '&');
    const fmtUrl = url.includes('fmt=') ? url : `${url}&fmt=srv3`;
    console.log(`Downloading direct track: ${directTrack.languageCode}`);
    try {
      const res = await fetch(fmtUrl, { headers });
      const xml = await res.text();
      const subs = parseTimedTextXml(xml);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles directly in ${directTrack.languageCode}`);
        return { subtitles: subs, sourceLang: directTrack.languageCode };
      }
    } catch (err) {
      console.error('Direct track download failed:', err);
    }
  }

  // 2) If no direct track, use any translatable track + tlang parameter
  const translatableTrack = tracks.find((t: any) => t.isTranslatable);
  if (translatableTrack?.baseUrl) {
    const url = translatableTrack.baseUrl.replace(/\\u0026/g, '&');
    const fmtUrl = url.includes('fmt=') ? url : `${url}&fmt=srv3`;
    const tlangUrl = `${fmtUrl}&tlang=${encodeURIComponent(targetLang)}`;
    console.log(`Downloading translated track: ${translatableTrack.languageCode} → ${targetLang}`);
    try {
      const res = await fetch(tlangUrl, { headers });
      const xml = await res.text();
      const subs = parseTimedTextXml(xml);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles via translation ${translatableTrack.languageCode}→${targetLang}`);
        return { subtitles: subs, sourceLang: translatableTrack.languageCode };
      }
    } catch (err) {
      console.error('Translated track download failed:', err);
    }

    // 3) Try downloading the source track without translation as last resort
    console.log(`Trying source track without translation: ${translatableTrack.languageCode}`);
    try {
      const res = await fetch(fmtUrl, { headers });
      const xml = await res.text();
      const subs = parseTimedTextXml(xml);
      if (subs.length > 0) {
        console.log(`✓ Got ${subs.length} subtitles in source language ${translatableTrack.languageCode}`);
        return { subtitles: subs, sourceLang: translatableTrack.languageCode };
      }
    } catch {}
  }

  return { subtitles: [], sourceLang: '' };
}

/**
 * Fallback: try the old timedtext list API (works for some videos)
 */
async function fetchViaTimedTextList(videoId: string, lang: string): Promise<Sub[]> {
  try {
    const listRes = await fetch(`https://video.google.com/timedtext?type=list&v=${videoId}`, { headers });
    const listBody = await listRes.text();
    if (!listBody.trim()) return [];

    // Parse track list
    const trackRegex = /<track\s+([^>]+?)\/?>(?:<\/track>)?/g;
    const attrRegex = /(\w+)="([^"]*)"/g;
    let match: RegExpExecArray | null;
    const tracks: { lang: string; name?: string; kind?: string }[] = [];

    while ((match = trackRegex.exec(listBody)) !== null) {
      const attrs = Object.fromEntries(
        Array.from(match[1].matchAll(attrRegex)).map(([, k, v]) => [k, v])
      );
      const trackLang = attrs.lang_code || attrs.lang || '';
      if (trackLang) tracks.push({ lang: trackLang, name: attrs.name, kind: attrs.kind });
    }

    if (tracks.length === 0) return [];

    const directTrack = tracks.find(t => t.lang === lang) || tracks.find(t => t.lang.startsWith(lang));
    const fallbackTrack = tracks.find(t => t.lang === 'en') || tracks[0];
    const selectedTrack = directTrack || fallbackTrack;
    if (!selectedTrack) return [];

    const tlang = !directTrack && selectedTrack.lang !== lang ? `&tlang=${lang}` : '';
    const params = new URLSearchParams({ v: videoId, lang: selectedTrack.lang, fmt: 'srv3' });
    if (selectedTrack.name) params.set('name', selectedTrack.name);
    if (selectedTrack.kind) params.set('kind', selectedTrack.kind);

    const url = `https://video.google.com/timedtext?${params.toString()}${tlang}`;
    const res = await fetch(url, { headers });
    const body = await res.text();
    if (!body.trim()) return [];

    return parseTimedTextXml(body);
  } catch {
    return [];
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
    console.log(`=== Fetching captions for ${videoId}, lang: ${lang} ===`);

    // Strategy 1: Scrape watch page for signed caption URLs (most reliable)
    const tracks = await scrapeCaptionTracks(videoId);
    if (tracks.length > 0) {
      const result = await downloadFromTrack(tracks, lang);
      if (result.subtitles.length > 0) {
        return new Response(JSON.stringify({
          subtitles: result.subtitles,
          language: lang,
          count: result.subtitles.length,
          source: 'watch-scrape',
          sourceLang: result.sourceLang,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Strategy 2: Fallback to timedtext list API
    console.log('Watch page scrape failed, trying timedtext list API...');
    const timedTextSubs = await fetchViaTimedTextList(videoId, lang);
    if (timedTextSubs.length > 0) {
      return new Response(JSON.stringify({
        subtitles: timedTextSubs,
        language: lang,
        count: timedTextSubs.length,
        source: 'timedtext-list',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // No subtitles found
    console.log('No subtitles found from any source');
    return new Response(JSON.stringify({
      subtitles: [],
      language: lang,
      count: 0,
      source: 'none',
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
