import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { YouTubeTranscriptApi } from "npm:@hallelx/youtube-transcript@0.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Sub { start: number; end: number; text: string }

const SUPADATA_API_KEY = Deno.env.get('SUPADATA_API_KEY') || '';

const VARIANTS: Record<string, string[]> = {
  zh: ['zh', 'zh-Hans', 'zh-CN', 'zh-Hant', 'zh-TW'],
  pt: ['pt', 'pt-BR', 'pt-PT'],
  es: ['es', 'es-419', 'es-ES'],
  en: ['en', 'en-US', 'en-GB'],
};
const variantsOf = (lang: string) => VARIANTS[lang] || [lang];

// ── Free path: YouTube's own caption tracks via the open-source
// @hallelx/youtube-transcript library (no API key, no credits). YouTube
// sometimes blocks cloud IPs, so this is tried first with a short time budget
// and Supadata (paid) stays as the fallback.
const FREE_TIME_BUDGET_MS = 10000;
// The Watch page gives up after 30s; always answer before that.
const SERVER_BUDGET_MS = 25000;

const freeApi = new YouTubeTranscriptApi({
  fetchFn: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8000) }),
});

function mapFreeSnippets(snippets: { text: string; start: number; duration: number }[]): Sub[] {
  return snippets
    .map((s) => ({ start: s.start, end: s.start + s.duration, text: (s.text || '').trim() }))
    .filter((s) => s.text.length > 0);
}

interface FreeResult { learning: Sub[]; native: Sub[]; available: string[] }

async function fetchFreeTracks(videoId: string, lang: string, native: string): Promise<FreeResult> {
  const list = await freeApi.list(videoId);
  const available = [...list].map((t) => t.languageCode);
  // YouTube answered and simply has no track in this language — report that
  // instead of throwing, so we don't wait on a slow paid AI transcription.
  if (!variantsOf(lang).some((code) => available.includes(code))) {
    return { learning: [], native: [], available };
  }
  // findTranscript prefers human-made tracks, then auto-generated ones.
  const learningTrack = list.findTranscript(variantsOf(lang));
  const learning = mapFreeSnippets((await learningTrack.fetch()).snippets);
  if (native === lang) return { learning, native: learning, available };

  let nativeSubs: Sub[] = [];
  try {
    nativeSubs = mapFreeSnippets((await list.findTranscript(variantsOf(native)).fetch()).snippets);
  } catch {
    // No native track — ask YouTube to auto-translate the learning track.
    const target = variantsOf(native).find((code) =>
      learningTrack.translationLanguages.some((t) => t.languageCode === code));
    if (target) {
      try {
        nativeSubs = mapFreeSnippets((await learningTrack.translate(target).fetch()).snippets);
      } catch (e: any) {
        console.log(`Free native translation failed: ${e.message}`);
      }
    }
  }
  return { learning, native: nativeSubs, available };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

async function supadataFetch(url: string): Promise<Response> {
  // Retry on 429 with exponential backoff
  let lastBody = '';
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const delay = 1500 * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s, 12s
      console.log(`Retrying after ${delay}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, delay));
    }
    const res = await fetch(url, {
      headers: { 'x-api-key': SUPADATA_API_KEY },
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) return res;
    lastStatus = res.status;
    lastBody = await res.text();
    console.log(`Supadata ${res.status}: ${lastBody.slice(0, 200)}`);
    if (res.status !== 429) break; // only retry rate limits
  }
  // Surface a human-readable message when Supadata returns structured JSON.
  try {
    const parsed = JSON.parse(lastBody);
    const detail = parsed.details || parsed.message;
    if (detail) throw new Error(detail);
  } catch (e: any) {
    if (e.message && e.message !== lastBody) throw e;
  }
  throw new Error(`Supadata ${lastStatus}: ${lastBody.slice(0, 200)}`);
}

async function fetchSupadataTranscript(videoId: string, lang: string): Promise<Sub[]> {
  const url = new URL('https://api.supadata.ai/v1/transcript');
  url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set('lang', lang);
  url.searchParams.set('text', 'false');
  url.searchParams.set('mode', 'auto');

  console.log(`Supadata: fetching ${videoId} lang=${lang}`);
  const res = await supadataFetch(url.toString());

  const data = await res.json();

  // Supadata may return a jobId for large videos
  if (data.jobId && !data.content) {
    console.log(`Supadata job queued: ${data.jobId} — polling`);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const jobRes = await fetch(`https://api.supadata.ai/v1/transcript/${data.jobId}`, {
        headers: { 'x-api-key': SUPADATA_API_KEY },
      });
      if (!jobRes.ok) continue;
      const jobData = await jobRes.json();
      if (jobData.status === 'completed' && jobData.content) {
        return mapSupadataContent(jobData.content);
      }
      if (jobData.status === 'failed') {
        throw new Error(`Supadata job failed: ${jobData.error || 'unknown'}`);
      }
    }
    throw new Error('Supadata job timeout');
  }

  return mapSupadataContent(data.content || []);
}

function mapSupadataContent(content: any[]): Sub[] {
  if (!Array.isArray(content)) return [];
  return content
    .map((c) => {
      // offset & duration are in milliseconds per Supadata docs
      const startMs = c.offset ?? c.startMs ?? c.start ?? 0;
      const durMs = c.duration ?? c.durationMs ?? 0;
      const start = startMs / 1000;
      const end = (startMs + durMs) / 1000;
      const text = (c.text || '').trim();
      return { start, end, text };
    })
    .filter((s) => s.text.length > 0);
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
    let source = 'youtube-free';
    const startedAt = Date.now();
    // Track languages YouTube reported, when it answered at all (null = blocked/failed).
    let available: string[] | null = null;

    try {
      const free = await withTimeout(fetchFreeTracks(videoId, lang, native), FREE_TIME_BUDGET_MS);
      learning = free.learning;
      nativeSubs = free.native;
      available = free.available;
      console.log(`Free path: learning=${learning.length}, native=${nativeSubs.length}, available=[${available.join(',')}]`);
    } catch (e: any) {
      console.log(`Free path failed (${e?.constructor?.name}): ${String(e?.message).slice(0, 200)}`);
    }

    if (!learning.length && available) {
      // YouTube answered: this video has no track in the learning language.
      // Supadata could only AI-transcribe it, which outlasts the client's 30s
      // timeout and burns a credit — answer now so the client can fall back.
      learningError = `No ${lang} captions on YouTube for this video`;
      nativeSubs = [];
    } else if (!learning.length) {
      // Free path was blocked or failed → paid fallback, kept inside the
      // client's 30s window so the learner gets an answer either way.
      source = 'supadata';
      if (!SUPADATA_API_KEY) throw new Error('SUPADATA_API_KEY not configured');
      const remaining = Math.max(5000, SERVER_BUDGET_MS - (Date.now() - startedAt));
      try {
        ({ learning, nativeSubs, learningError, nativeError } = await withTimeout(fetchViaSupadata(videoId, lang, native), remaining));
      } catch (e: any) {
        learningError = `Caption provider took too long (${e.message})`;
      }
    }

    // Detect duplicate: providers sometimes return the original-language track
    // when the requested native language isn't available. Compare first few segments.
    if (native !== lang && learning.length && nativeSubs.length) {
      const sampleSize = Math.min(5, learning.length, nativeSubs.length);
      let identical = 0;
      for (let i = 0; i < sampleSize; i++) {
        if ((learning[i].text || '').trim() === (nativeSubs[i].text || '').trim()) identical++;
      }
      if (identical === sampleSize) {
        console.log(`Native track is duplicate of learning track — discarding so client can AI-translate`);
        nativeSubs = [];
        nativeError = `No ${native} captions available on YouTube`;
      }
    }

    console.log(`Final (${source}): learning=${learning.length}, native=${nativeSubs.length}`);

    return new Response(JSON.stringify({
      subtitles: learning,
      nativeSubtitles: nativeSubs,
      language: lang,
      nativeLanguage: native,
      count: learning.length,
      nativeCount: nativeSubs.length,
      source,
      ...(available ? { availableLanguages: available } : {}),
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

async function fetchViaSupadata(videoId: string, lang: string, native: string) {
  let learning: Sub[] = [];
  let nativeSubs: Sub[] = [];
  let learningError: string | null = null;
  let nativeError: string | null = null;

  for (const variant of variantsOf(lang)) {
    try {
      learning = await fetchSupadataTranscript(videoId, variant);
      learningError = null;
      if (learning.length) break;
    } catch (e: any) {
      learningError = e.message;
      console.log(`Learning lang fetch failed (${variant}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  if (native !== lang) {
    // Space requests out to respect free-plan rate limit (~1 req/sec)
    await new Promise((r) => setTimeout(r, 1500));
    try {
      nativeSubs = await fetchSupadataTranscript(videoId, native);
    } catch (e: any) {
      nativeError = e.message;
      console.log(`Native lang fetch failed: ${e.message}`);
    }
  } else {
    nativeSubs = learning;
  }

  return { learning, nativeSubs, learningError, nativeError };
}
