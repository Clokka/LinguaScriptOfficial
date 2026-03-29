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

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'YouTube API key not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const lang = language || 'fr';

    // Step 1: List available captions
    const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok) {
      console.error('YouTube API error:', JSON.stringify(listData));
      return new Response(JSON.stringify({ error: 'Failed to list captions', details: listData }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try to find caption track for the target language
    const captions = listData.items || [];
    let captionTrack = captions.find((c: any) => c.snippet.language === lang);
    
    // Fallback: try any available track
    if (!captionTrack && captions.length > 0) {
      captionTrack = captions[0];
    }

    // Alternative approach: Use timedtext API (works without OAuth)
    // YouTube's timedtext endpoint is publicly accessible for videos with captions
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
    const ttRes = await fetch(timedtextUrl);
    
    if (ttRes.ok) {
      const xmlText = await ttRes.text();
      if (xmlText && xmlText.includes('<text')) {
        // Parse the XML subtitle format
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

        if (subtitles.length > 0) {
          return new Response(JSON.stringify({ subtitles, language: lang, source: 'timedtext' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Try auto-generated captions (asr=1)
    const asrUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3&kind=asr`;
    const asrRes = await fetch(asrUrl);
    
    if (asrRes.ok) {
      const xmlText = await asrRes.text();
      if (xmlText && xmlText.includes('<text')) {
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

        if (subtitles.length > 0) {
          return new Response(JSON.stringify({ subtitles, language: lang, source: 'auto-generated' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      subtitles: [], 
      language: lang, 
      source: 'none',
      message: 'No captions found for this video',
      availableTracks: captions.map((c: any) => ({ language: c.snippet.language, name: c.snippet.name }))
    }), {
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
