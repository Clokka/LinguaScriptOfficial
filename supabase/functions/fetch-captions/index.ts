import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Sub { start: number; end: number; text: string }

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

// yt-dlp uses ANDROID_EMBEDDED_PLAYER to bypass datacenter IP restrictions
// that block the WEB client. This is the key to server-side extraction.
const INNERTUBE_CLIENTS = [
  {
    clientName: "ANDROID_EMBEDDED_PLAYER",
    clientVersion: "19.02.39",
    androidSdkVersion: 30,
    userAgent: "com.google.android.youtube/19.02.39 (Linux; U; Android 11) gzip",
  },
  {
    clientName: "WEB_EMBEDDED_PLAYER",
    clientVersion: "2.20230101.00.00",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  {
    clientName: "WEB",
    clientVersion: "2.20240101.00.00",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
];

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTimedTextXml(xml: string): Sub[] {
  const subs: Sub[] = [];
  const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = textRegex.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const dur = parseFloat(m[2]);
    const text = decodeHtml(m[3].replace(/<[^>]+>/g, ""));
    if (text) subs.push({ start, end: start + dur, text });
  }
  if (subs.length > 0) return subs;

  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = pRegex.exec(xml)) !== null) {
    const start = parseInt(m[1]) / 1000;
    const dur = parseInt(m[2]) / 1000;
    const text = decodeHtml(m[3].replace(/<[^>]+>/g, ""));
    if (text) subs.push({ start, end: start + dur, text });
  }
  return subs;
}

function parseJson3(json: any): Sub[] {
  const subs: Sub[] = [];
  for (const event of (json?.events || [])) {
    if (!event.segs || event.tStartMs === undefined) continue;
    const text = decodeHtml(event.segs.map((s: any) => s.utf8 || "").join("").trim());
    if (!text || text === "\n") continue;
    const start = event.tStartMs / 1000;
    const end = (event.tStartMs + (event.dDurationMs || 3000)) / 1000;
    subs.push({ start, end, text });
  }
  return subs;
}

async function getInnerTubeTracks(videoId: string): Promise<CaptionTrack[]> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const payload: any = {
        context: {
          client: {
            clientName: client.clientName,
            clientVersion: client.clientVersion,
            hl: "en",
            gl: "US",
          },
        },
        videoId,
      };
      if ("androidSdkVersion" in client) {
        payload.context.client.androidSdkVersion = client.androidSdkVersion;
      }

      console.log(`[fetch-captions] Trying InnerTube client: ${client.clientName}`);
      const res = await fetch(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": client.userAgent,
            "X-YouTube-Client-Name": "55",
            "Origin": "https://www.youtube.com",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!res.ok) {
        console.warn(`[fetch-captions] ${client.clientName} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const tracks: CaptionTrack[] =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

      if (tracks.length > 0) {
        console.log(`[fetch-captions] ${client.clientName}: found ${tracks.length} tracks`);
        return tracks;
      }
      console.warn(`[fetch-captions] ${client.clientName}: no caption tracks`);
    } catch (e) {
      console.warn(`[fetch-captions] ${client.clientName} error:`, e);
    }
  }
  return [];
}

async function downloadTrack(baseUrl: string, targetLang: string, isBase: boolean): Promise<Sub[]> {
  for (const fmt of ["json3", "srv3"] as const) {
    try {
      let url = baseUrl;
      if (!isBase) url += `&tlang=${targetLang}`;
      url += `&fmt=${fmt}`;

      const res = await fetch(url, {
        headers: { "User-Agent": INNERTUBE_CLIENTS[0].userAgent },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;

      if (fmt === "json3") {
        try {
          const json = await res.json();
          const subs = parseJson3(json);
          if (subs.length > 0) return subs;
        } catch { /* not valid JSON */ }
      } else {
        const text = await res.text();
        if (text.length > 50) {
          const subs = parseTimedTextXml(text);
          if (subs.length > 0) return subs;
        }
      }
    } catch (e) {
      console.warn(`[fetch-captions] ${fmt} download error:`, e);
    }
  }
  return [];
}

async function fetchYouTubeSubtitles(
  videoId: string,
  learningLang: string,
  nativeLang: string
): Promise<{ learning: Sub[]; native: Sub[] }> {
  const tracks = await getInnerTubeTracks(videoId);

  if (tracks.length === 0) {
    console.warn("[fetch-captions] No caption tracks found for", videoId);
    return { learning: [], native: [] };
  }

  for (const t of tracks) {
    console.log(`[fetch-captions] Track: ${t.languageCode} kind=${t.kind || "standard"}`);
  }

  const exactLearning = tracks.find((t) => t.languageCode === learningLang);
  const exactNative = tracks.find((t) => t.languageCode === nativeLang);
  const baseTrack = exactLearning || exactNative || tracks[0];

  console.log(`[fetch-captions] Base track: ${baseTrack.languageCode}`);

  let learning: Sub[] = [];
  let native: Sub[] = [];

  learning = await downloadTrack(
    baseTrack.baseUrl,
    learningLang,
    baseTrack.languageCode === learningLang
  );

  if (learningLang !== nativeLang) {
    if (exactNative) {
      native = await downloadTrack(exactNative.baseUrl, nativeLang, true);
    } else {
      native = await downloadTrack(baseTrack.baseUrl, nativeLang, false);
    }
  } else {
    native = learning;
  }

  console.log(`[fetch-captions] Done: learning=${learning.length}, native=${native.length}`);
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
    console.log(`=== fetch-captions: ${videoId}, learning=${lang}, native=${native} ===`);

    let learning: Sub[] = [];
    let nativeSubs: Sub[] = [];
    let learningError: string | null = null;
    let nativeError: string | null = null;

    try {
      const result = await fetchYouTubeSubtitles(videoId, lang, native);
      learning = result.learning;
      nativeSubs = result.native;

      if (learning.length === 0) {
        learningError = `No ${lang} captions available on YouTube`;
      }
      if (lang !== native && nativeSubs.length === 0) {
        nativeError = `No ${native} captions available on YouTube`;
      }
    } catch (e: any) {
      learningError = e.message;
      console.error('[fetch-captions] Extraction failed:', e);
    }

    // Detect duplicate: sometimes YouTube returns original-language track
    // when tlang translation isn't available
    if (lang !== native && learning.length && nativeSubs.length) {
      const sampleSize = Math.min(5, learning.length, nativeSubs.length);
      let identical = 0;
      for (let i = 0; i < sampleSize; i++) {
        if ((learning[i].text || '').trim() === (nativeSubs[i].text || '').trim()) identical++;
      }
      if (identical === sampleSize) {
        console.log('Native track is duplicate of learning track — discarding');
        nativeSubs = [];
        nativeError = `No ${native} captions available on YouTube`;
      }
    }

    console.log(`Final: learning=${learning.length}, native=${nativeSubs.length}`);

    return new Response(JSON.stringify({
      subtitles: learning,
      nativeSubtitles: nativeSubs,
      language: lang,
      nativeLanguage: native,
      count: learning.length,
      nativeCount: nativeSubs.length,
      source: 'innertube',
      ...(learningError ? { learningError } : {}),
      ...(nativeError ? { nativeError } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
