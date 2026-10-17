// LinguaScript Stremio addon: dual subtitles (learning language on top, your
// language underneath). Install link: <functions>/stremio-addon/es-en/manifest.json
// where "es" is the language you learn and "en" is your own language.
//
// Flow: Stremio asks /{cfg}/subtitles/{type}/{id}.json → we look up subtitles
// in the learning language on Stremio's free OpenSubtitles feed and hand back
// links to /{cfg}/dual.srt?src=… → that downloads the subtitle, translates
// every line and returns one SRT with both lines in each cue.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, hasAIKey } from "../_shared/aiChat.ts";
import { freeTranslateLines } from "../_shared/freeTranslate.ts";
import { buildDualSrt, decodeSubtitle, parseSrt, plainText } from "./srt.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const SITE_URL = 'https://linguascript.co.uk';
const OPENSUBS_FEED = 'https://opensubtitles-v3.strem.io';

// Same languages as src/lib/languages.ts, plus the ISO 639-2 codes the
// OpenSubtitles feed uses for each one.
const LANGS: Record<string, { label: string; subs: string[] }> = {
  en: { label: 'English', subs: ['eng', 'en'] },
  es: { label: 'Spanish', subs: ['spa', 'spn', 'ea', 'es'] },
  fr: { label: 'French', subs: ['fre', 'fra', 'fr'] },
  de: { label: 'German', subs: ['ger', 'deu', 'de'] },
  it: { label: 'Italian', subs: ['ita', 'it'] },
  pt: { label: 'Portuguese', subs: ['por', 'pob', 'pt', 'pb'] },
  zh: { label: 'Chinese', subs: ['chi', 'zho', 'zht', 'zhe', 'ze', 'zh'] },
  ja: { label: 'Japanese', subs: ['jpn', 'ja'] },
  ko: { label: 'Korean', subs: ['kor', 'ko'] },
  ar: { label: 'Arabic', subs: ['ara', 'ar'] },
  hi: { label: 'Hindi', subs: ['hin', 'hi'] },
  th: { label: 'Thai', subs: ['tha', 'th'] },
  ru: { label: 'Russian', subs: ['rus', 'ru'] },
  tr: { label: 'Turkish', subs: ['tur', 'tr'] },
  nl: { label: 'Dutch', subs: ['dut', 'nld', 'nl'] },
  pl: { label: 'Polish', subs: ['pol', 'pl'] },
  sv: { label: 'Swedish', subs: ['swe', 'sv'] },
};

const MAX_SUBTITLE_OPTIONS = 3;

interface Config { learn: string; native: string }

/** "es-en" → { learn: "es", native: "en" }; null when unknown. */
function parseConfig(segment: string | undefined): Config | null {
  const m = /^([a-z]{2})-([a-z]{2})$/.exec(segment || '');
  if (!m || !LANGS[m[1]] || !LANGS[m[2]] || m[1] === m[2]) return null;
  return { learn: m[1], native: m[2] };
}

const publicBase = () =>
  `${(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')}/functions/v1/stremio-addon`;

const json = (body: unknown, status = 200, cacheSeconds = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(cacheSeconds ? { 'Cache-Control': `public, max-age=${cacheSeconds}` } : {}),
    },
  });

function manifest(cfg: Config | null) {
  const name = cfg
    ? `LinguaScript ${LANGS[cfg.learn].label} + ${LANGS[cfg.native].label}`
    : 'LinguaScript Dual Subtitles';
  return {
    id: cfg ? `uk.co.linguascript.dualsubs.${cfg.learn}-${cfg.native}` : 'uk.co.linguascript.dualsubs',
    version: '1.0.0',
    name,
    description:
      'Dual subtitles for language learners: the language you are learning on top, your own language underneath.',
    logo: `${SITE_URL}/logo.svg`,
    resources: ['subtitles'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: [],
    behaviorHints: { configurable: true, configurationRequired: !cfg },
  };
}

/** Finds subtitles in the learning language for one movie/episode. */
async function findSubtitles(cfg: Config, type: string, idWithExtra: string) {
  const res = await fetch(`${OPENSUBS_FEED}/subtitles/${type}/${idWithExtra}.json`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OpenSubtitles feed returned ${res.status}`);
  const data = await res.json();
  const wanted = new Set(LANGS[cfg.learn].subs);
  const list: { id: string; url: string; lang: string }[] = Array.isArray(data?.subtitles) ? data.subtitles : [];
  const label = `${LANGS[cfg.learn].label} + ${LANGS[cfg.native].label} (LinguaScript)`;
  return list
    .filter((s) => s?.url && wanted.has(String(s.lang || '').toLowerCase()))
    .slice(0, MAX_SUBTITLE_OPTIONS)
    .map((s, i) => ({
      id: `linguascript-${cfg.learn}-${cfg.native}-${s.id ?? i}`,
      url: `${publicBase()}/${cfg.learn}-${cfg.native}/dual.srt?src=${encodeURIComponent(s.url)}`,
      lang: i === 0 ? label : `${label} #${i + 1}`,
    }));
}

// Only fetch subtitle files from Stremio/OpenSubtitles hosts, so this
// function can't be used as an open proxy.
function isAllowedSource(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === 'https:' && /(^|\.)(strem\.io|opensubtitles\.(org|com))$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** Translates every line, AI first, free translator for any batch that fails. */
async function translateAll(lines: string[], from: string, to: string): Promise<string[]> {
  const out: string[] = new Array(lines.length).fill('');
  const BATCH = 40;
  const CONCURRENCY = 6;
  const batches: number[] = [];
  for (let i = 0; i < lines.length; i += BATCH) batches.push(i);

  const runBatch = async (start: number) => {
    const batch = lines.slice(start, start + BATCH);
    let got: string[] | null = null;
    if (hasAIKey()) {
      try {
        const numbered = batch.map((t, i) => `${i + 1}. ${t}`).join('\n');
        const response = await aiChat({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: `You are a professional subtitle translator. Translate from ${from} to ${to}. Return only numbered translations matching the input format. No explanations.` },
            { role: 'user', content: `Translate these ${from} subtitle lines to ${to}. Return exactly one numbered line per input line, keeping the same numbers. Be natural and conversational.\n\n${numbered}` },
          ],
          temperature: 0.3,
        });
        if (!response.ok) throw new Error(`AI ${response.status}`);
        const data = await response.json();
        const text: string = data.choices?.[0]?.message?.content || '';
        // Match by number so one skipped line can't shift every line after it.
        const byNum = new Map<number, string>();
        for (const line of text.split('\n')) {
          const m = /^\s*(\d+)[.)]\s*(.*)$/.exec(line);
          if (m) byNum.set(Number(m[1]), m[2].trim());
        }
        got = batch.map((_, i) => byNum.get(i + 1) || '');
      } catch (e) {
        console.warn('AI batch failed, using free translator:', (e as Error).message);
      }
    }
    const missing = got ? batch.map((_, i) => i).filter((i) => !got![i]) : batch.map((_, i) => i);
    if (missing.length) {
      try {
        const free = await freeTranslateLines(missing.map((i) => batch[i]), from, to);
        got = got || new Array(batch.length).fill('');
        missing.forEach((i, k) => { got![i] = free[k] || ''; });
      } catch (e) {
        console.warn('Free translator failed:', (e as Error).message);
      }
    }
    (got || []).forEach((t, i) => { out[start + i] = t; });
  };

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      while (next < batches.length) await runBatch(batches[next++]);
    }),
  );
  return out;
}

// Warm-isolate cache so pausing/seeking (Stremio re-requests the file) is instant.
const dualCache = new Map<string, Promise<string>>();

async function buildDual(cfg: Config, src: string): Promise<string> {
  const res = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Subtitle download failed: ${res.status}`);
  const cues = parseSrt(decodeSubtitle(new Uint8Array(await res.arrayBuffer())));
  if (!cues.length) throw new Error('Subtitle file had no lines');
  const translations = await translateAll(
    cues.map((c) => plainText(c.text)),
    LANGS[cfg.learn].label,
    LANGS[cfg.native].label,
  );
  return buildDualSrt(cues, translations);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const at = parts.indexOf('stremio-addon');
  const path = at >= 0 ? parts.slice(at + 1) : parts;

  try {
    // /manifest.json — not set up yet, Stremio shows a "Configure" button.
    if (path.length === 1 && path[0] === 'manifest.json') return json(manifest(null), 200, 3600);

    // /configure or /{cfg}/configure → the install page on the website.
    if (path[path.length - 1] === 'configure' || path.length === 0) {
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: `${SITE_URL}/stremio` } });
    }

    const cfg = parseConfig(path[0]);
    if (!cfg) return json({ error: 'Unknown language pair. Use e.g. /es-en/manifest.json' }, 404);
    const rest = path.slice(1);

    if (rest.length === 1 && rest[0] === 'manifest.json') return json(manifest(cfg), 200, 3600);

    // /{cfg}/subtitles/{type}/{id}.json or /{cfg}/subtitles/{type}/{id}/{extra}.json
    if (rest[0] === 'subtitles' && rest.length >= 3) {
      const type = rest[1];
      const idWithExtra = rest.slice(2).join('/').replace(/\.json$/, '');
      if (!/^(movie|series)$/.test(type) || !idWithExtra.startsWith('tt')) return json({ subtitles: [] });
      try {
        return json({ subtitles: await findSubtitles(cfg, type, idWithExtra) }, 200, 3600);
      } catch (e) {
        console.warn('Subtitle lookup failed:', (e as Error).message);
        return json({ subtitles: [] });
      }
    }

    if (rest.length === 1 && rest[0] === 'dual.srt') {
      const src = url.searchParams.get('src') || '';
      if (!isAllowedSource(src)) return json({ error: 'src must be a Stremio/OpenSubtitles link' }, 400);
      const key = `${cfg.learn}-${cfg.native}|${src}`;
      let job = dualCache.get(key);
      if (!job) {
        job = buildDual(cfg, src);
        dualCache.set(key, job);
        job.catch(() => dualCache.delete(key));
        if (dualCache.size > 50) dualCache.delete(dualCache.keys().next().value!);
      }
      const srt = await job;
      return new Response(srt, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/x-subrip; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('stremio-addon error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
