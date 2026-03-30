import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

interface Sub { start: number; end: number; text: string }

function parseSRT(srt: string): Sub[] {
  return srt
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\n+/)
    .map(block => {
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

function parseXML(xml: string): Sub[] {
  const subs: Sub[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const dur = parseFloat(m[2]);
    const text = m[3]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
    if (text) subs.push({ start, end: start + dur, text });
  }
  return subs;
}

async function fetchTrack(videoId: string, lang: string): Promise<Sub[]> {
  // Strategy 1: video.google.com/timedtext SRT format
  const googleUrls = [
    `https://video.google.com/timedtext?v=${videoId}&lang=${lang}&fmt=srt`,
    `https://video.google.com/timedtext?v=${videoId}&lang=${lang}&fmt=srt&kind=asr`,
  ];

  for (const url of googleUrls) {
    try {
      console.log(`Trying: ${url}`);
      const res = await fetch(url, { headers });
      if (res.ok) {
        const body = await res.text();
        if (body.length > 20) {
          const subs = parseSRT(body);
          if (subs.length > 0) {
            console.log(`✓ Got ${subs.length} subs from video.google.com SRT (${lang})`);
            return subs;
          }
        }
      }
    } catch {}
  }

  // Strategy 2: youtube.com/api/timedtext XML format
  const ytUrls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`,
  ];

  for (const url of ytUrls) {
    try {
      console.log(`Trying: ${url}`);
      const res = await fetch(url, { headers });
      if (res.ok) {
        const body = await res.text();
        if (body.length > 20) {
          const subs = parseXML(body);
          if (subs.length > 0) {
            console.log(`✓ Got ${subs.length} subs from youtube timedtext XML (${lang})`);
            return subs;
          }
        }
      }
    } catch {}
  }

  // Strategy 3: Embed page scraping for signed caption URLs
  try {
    console.log(`Trying embed page scrape for ${videoId}`);
    const embedRes = await fetch(`https://www.youtube.com/embed/${videoId}`, { headers });
    if (embedRes.ok) {
      const html = await embedRes.text();
      const captionMatch = html.match(/"captionTracks"\s*:\s*(\[.*?\])\s*,/s);
      if (captionMatch) {
        const tracks = JSON.parse(captionMatch[1]);
        const track = tracks.find((t: any) => t.languageCode === lang)
          || tracks.find((t: any) => t.languageCode?.startsWith(lang));

        if (track?.baseUrl) {
          let captionUrl = track.baseUrl;
          if (!captionUrl.includes('fmt=')) captionUrl += '&fmt=srv3';
          const capRes = await fetch(captionUrl, { headers });
          if (capRes.ok) {
            const xml = await capRes.text();
            const subs = parseXML(xml);
            if (subs.length > 0) {
              console.log(`✓ Got ${subs.length} subs from embed scrape (${lang})`);
              return subs;
            }
          }
        }

        // Try translation via tlang if direct track not found
        if (!track) {
          const anyTrack = tracks[0];
          if (anyTrack?.baseUrl) {
            let captionUrl = anyTrack.baseUrl;
            if (!captionUrl.includes('fmt=')) captionUrl += '&fmt=srv3';
            captionUrl += `&tlang=${encodeURIComponent(lang)}`;
            const capRes = await fetch(captionUrl, { headers });
            if (capRes.ok) {
              const xml = await capRes.text();
              const subs = parseXML(xml);
              if (subs.length > 0) {
                console.log(`✓ Got ${subs.length} subs via tlang translation to ${lang}`);
                return subs;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Embed scrape error:', e);
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
