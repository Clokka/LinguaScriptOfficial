import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseTimestamp(ts: string): number {
  // Format: PT#H#M#S or PT#M#S.#s
  const match = ts.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseFloat(match[3] || "0");
  return h * 3600 + m * 60 + s;
}

function parseSrt(srt: string): { start: number; end: number; text: string }[] {
  const blocks = srt.trim().split(/\n\n+/);
  return blocks.map(block => {
    const lines = block.split('\n');
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) return null;
    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
    const parseTime = (t: string) => {
      const parts = t.split(':');
      const [sec, ms] = parts[2].split(/[.,]/);
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(sec) + parseInt(ms || '0') / 1000;
    };
    const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    return { start: parseTime(startStr), end: parseTime(endStr), text };
  }).filter(Boolean) as any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId, language } = await req.json();
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const lang = language || 'fr';

    const parseXmlSubtitles = (xmlText: string): { start: number; end: number; text: string }[] => {
      const subtitles: { start: number; end: number; text: string }[] = [];
      const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs;
      let match;
      while ((match = regex.exec(xmlText)) !== null) {
        const start = parseFloat(match[1]);
        const dur = parseFloat(match[2]);
        const text = match[3]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/<[^>]+>/g, '')
          .trim();
        if (text) {
          subtitles.push({ start, end: start + dur, text });
        }
      }
      return subtitles;
    };

    // Try public timedtext endpoint FIRST (no API key needed)
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
    console.log('Trying timedtext:', timedtextUrl);
    const ttRes = await fetch(timedtextUrl);
    
    if (ttRes.ok) {
      const xmlText = await ttRes.text();
      const subtitles = parseXmlSubtitles(xmlText);
      if (subtitles.length > 0) {
        return new Response(JSON.stringify({ subtitles, language: lang, source: 'timedtext' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Try auto-generated captions
    const asrUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`;
    console.log('Trying ASR:', asrUrl);
    const asrRes = await fetch(asrUrl);
    
    if (asrRes.ok) {
      const xmlText = await asrRes.text();
      const subtitles = parseXmlSubtitles(xmlText);
      if (subtitles.length > 0) {
        return new Response(JSON.stringify({ subtitles, language: lang, source: 'auto-generated' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Last resort: try YouTube Data API if key is available
    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (apiKey) {
      const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listData = await listRes.json();
        const tracks = (listData.items || []).map((c: any) => ({ language: c.snippet.language, name: c.snippet.name }));
        return new Response(JSON.stringify({ subtitles: [], language: lang, source: 'none', message: 'Tracks found but cannot download without OAuth', availableTracks: tracks }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ subtitles: [], language: lang, source: 'none', message: 'No captions found for this video' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
