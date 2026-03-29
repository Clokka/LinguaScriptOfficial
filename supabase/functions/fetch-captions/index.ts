import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/))([^&?\s]+)/);
  return match ? match[1] : null;
}

interface CaptionEntry {
  start: number;
  dur: number;
  text: string;
}

async function fetchCaptionsFromTimedText(videoId: string, lang: string): Promise<CaptionEntry[]> {
  // Try fetching from YouTube's timedtext endpoint (no API key needed for auto-captions)
  const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
  const res = await fetch(url);
  if (!res.ok) return [];
  
  const xml = await res.text();
  if (!xml.includes('<text')) return [];
  
  const entries: CaptionEntry[] = [];
  const regex = /<text start="([^"]*)" dur="([^"]*)"[^>]*>(.*?)<\/text>/gs;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    entries.push({
      start: parseFloat(match[1]),
      dur: parseFloat(match[2]),
      text: match[3]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]*>/g, ''),
    });
  }
  return entries;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, language = 'fr' } = await req.json();
    
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: 'videoUrl is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const videoId = getYouTubeId(videoUrl);
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try timedtext endpoint first (works without OAuth for public captions)
    let captions = await fetchCaptionsFromTimedText(videoId, language);
    
    // If no captions in target language, try auto-generated
    if (captions.length === 0) {
      const autoUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${language}&kind=asr&fmt=srv3`;
      const autoRes = await fetch(autoUrl);
      if (autoRes.ok) {
        const xml = await autoRes.text();
        const entries: CaptionEntry[] = [];
        const regex = /<text start="([^"]*)" dur="([^"]*)"[^>]*>(.*?)<\/text>/gs;
        let match;
        while ((match = regex.exec(xml)) !== null) {
          entries.push({
            start: parseFloat(match[1]),
            dur: parseFloat(match[2]),
            text: match[3]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/<[^>]*>/g, ''),
          });
        }
        captions = entries;
      }
    }

    // Also try to get English translation for dual subs
    let translatedCaptions: CaptionEntry[] = [];
    if (language !== 'en') {
      translatedCaptions = await fetchCaptionsFromTimedText(videoId, 'en');
      if (translatedCaptions.length === 0) {
        // Try auto-translated
        const transUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${language}&tlang=en&fmt=srv3`;
        const transRes = await fetch(transUrl);
        if (transRes.ok) {
          const xml = await transRes.text();
          const entries: CaptionEntry[] = [];
          const regex = /<text start="([^"]*)" dur="([^"]*)"[^>]*>(.*?)<\/text>/gs;
          let match;
          while ((match = regex.exec(xml)) !== null) {
            entries.push({
              start: parseFloat(match[1]),
              dur: parseFloat(match[2]),
              text: match[3]
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/<[^>]*>/g, ''),
            });
          }
          translatedCaptions = entries;
        }
      }
    }

    // Format into subtitle entries
    const subtitles = captions.map((cap) => {
      const translatedEntry = translatedCaptions.find(
        tc => Math.abs(tc.start - cap.start) < 1.0
      );
      return {
        start: cap.start,
        end: cap.start + cap.dur,
        primary: cap.text,
        secondary: translatedEntry?.text || '',
      };
    });

    return new Response(JSON.stringify({ subtitles, count: subtitles.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
