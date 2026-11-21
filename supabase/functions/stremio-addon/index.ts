// LinguaScript Stremio add-on: dual-language subtitles inside the Stremio
// apps (desktop Windows/macOS/Linux, Android, TV, web). Stremio add-ons are
// Stremio's official plug-in system, so this is how LinguaScript gets into the
// Stremio DESKTOP app, where a browser extension can't reach.
//
// Install link (made on linguascript.co.uk/stremio):
//   stremio://<project>.supabase.co/functions/v1/stremio-addon/<learn>-<native>/manifest.json
// e.g. …/stremio-addon/fr-en/manifest.json = French subtitles with English underneath.
//
// Routes (Stremio add-on protocol):
//   /<cfg>/manifest.json
//   /<cfg>/subtitles/<movie|series>/<tt…[:season:episode]>[/<extra>].json
//   /<cfg>/sub/<fileId>.srt   → the dual subtitle file itself
//
// Subtitles come from OpenSubtitles (secret OPENSUBTITLES_API_KEY; optional
// OPENSUBTITLES_USERNAME / OPENSUBTITLES_PASSWORD raise the daily download
// quota). Translation: Google (official API when GOOGLE_TRANSLATE_API_KEY is
// set, else the free endpoint) via googleTranslateMany. Finished files are
// cached in the private storage bucket "stremio-subs" when it exists
// (docs/sql/stremio-addon.sql), so each episode is downloaded once.
// Deck colours (red/orange/green words) need a personal key: see
// docs/MEDIA_COMPATIBILITY.md, phase 2.
import { googleTranslateMany } from "../_shared/dictionary.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const OS_API = "https://api.opensubtitles.com/api/v1";
const UA = "LinguaScript v1.0";
const SITE = "https://linguascript.co.uk";
const BUCKET = "stremio-subs";

const NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese", ja: "Japanese",
  ko: "Korean", zh: "Chinese", ru: "Russian", ar: "Arabic", nl: "Dutch", pl: "Polish", sv: "Swedish",
  tr: "Turkish", hi: "Hindi", th: "Thai",
};

const json = (body: unknown, maxAge = 3600) =>
  new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${maxAge}` },
  });

/** "fr-en" → { learn: "fr", native: "en" }, or null when it isn't two known languages. */
function parseConfig(cfg: string) {
  const m = /^([a-z]{2})-([a-z]{2})$/.exec(cfg || "");
  if (!m || !NAMES[m[1]] || !NAMES[m[2]] || m[1] === m[2]) return null;
  return { learn: m[1], native: m[2] };
}

function manifest(cfg: string, learn: string, native: string) {
  return {
    id: `uk.co.linguascript.stremio.${cfg}`,
    version: "1.0.0",
    name: `LinguaScript ${learn.toUpperCase()}+${native.toUpperCase()}`,
    description: `${NAMES[learn]} subtitles with ${NAMES[native]} underneath, for learning ${NAMES[learn]} with films and series. From LinguaScript.`,
    logo: `${SITE}/logo.svg`,
    resources: ["subtitles"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: [],
    behaviorHints: { configurable: true },
  };
}

// ── OpenSubtitles ────────────────────────────────────────────────────────────
let osToken: { value: string; at: number } | null = null;
async function osHeaders(): Promise<Record<string, string>> {
  const key = Deno.env.get("OPENSUBTITLES_API_KEY");
  if (!key) throw new Error("OPENSUBTITLES_API_KEY is not set");
  const h: Record<string, string> = { "Api-Key": key, "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json" };
  const username = Deno.env.get("OPENSUBTITLES_USERNAME");
  const password = Deno.env.get("OPENSUBTITLES_PASSWORD");
  if (username && password) {
    if (!osToken || Date.now() - osToken.at > 12 * 3600_000) {
      const res = await fetch(`${OS_API}/login`, { method: "POST", headers: h, body: JSON.stringify({ username, password }) });
      if (res.ok) osToken = { value: (await res.json()).token, at: Date.now() };
    }
    if (osToken) h.Authorization = `Bearer ${osToken.value}`;
  }
  return h;
}

interface Found { fileId: number; hashMatch: boolean; downloads: number; release: string }

async function searchSubtitles(id: string, lang: string, extra: URLSearchParams): Promise<Found[]> {
  const [imdb, season, episode] = id.split(":");
  const q = new URLSearchParams({ imdb_id: imdb.replace(/^tt/, ""), languages: lang });
  if (season) q.set("season_number", season);
  if (episode) q.set("episode_number", episode);
  const hash = extra.get("videoHash");
  if (hash && /^[0-9a-f]{16}$/i.test(hash)) q.set("moviehash", hash);
  const res = await fetch(`${OS_API}/subtitles?${q}`, { headers: await osHeaders(), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`OpenSubtitles search ${res.status}`);
  const data = await res.json();
  const found: Found[] = [];
  for (const item of data?.data || []) {
    const a = item.attributes || {};
    const file = a.files?.[0];
    if (!file?.file_id || a.ai_translated || a.machine_translated) continue;
    found.push({ fileId: file.file_id, hashMatch: !!a.moviehash_match, downloads: a.download_count || 0, release: a.release || "" });
  }
  // A file made for this exact video first, then the most downloaded.
  return found.sort((x, y) => Number(y.hashMatch) - Number(x.hashMatch) || y.downloads - x.downloads).slice(0, 3);
}

async function downloadSubtitle(fileId: number): Promise<string> {
  const res = await fetch(`${OS_API}/download`, {
    method: "POST",
    headers: await osHeaders(),
    body: JSON.stringify({ file_id: fileId, sub_format: "srt" }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`OpenSubtitles download ${res.status}`);
  const { link } = await res.json();
  const file = await fetch(link, { signal: AbortSignal.timeout(15000) });
  if (!file.ok) throw new Error(`Subtitle file ${file.status}`);
  return await file.text();
}

// ── Dual subtitles ───────────────────────────────────────────────────────────
interface Cue { time: string; text: string }

function parseSrt(srt: string): Cue[] {
  return srt.replace(/^﻿/, "").replace(/\r/g, "").split(/\n{2,}/).flatMap((block) => {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) return [];
    const text = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
    return text ? [{ time: lines[i].trim(), text }] : [];
  });
}

const escapeSrt = (s: string) => s.replace(/</g, "‹").replace(/>/g, "›");

/** Learning-language line on top, the learner's own language smaller and grey underneath. */
async function makeDual(srt: string, learn: string, native: string): Promise<string> {
  const cues = parseSrt(srt);
  if (!cues.length) throw new Error("Empty subtitle file");
  let translated: string[] = [];
  try { translated = await googleTranslateMany(cues.map((c) => c.text), learn, native); } catch (e) { console.error("translate failed", e); }
  return cues.map((c, i) => {
    const tr = translated[i]?.trim();
    const second = tr && tr.toLowerCase() !== c.text.toLowerCase() ? `\n<font color="#B8B8C0"><i>${escapeSrt(tr)}</i></font>` : "";
    return `${i + 1}\n${c.time}\n${escapeSrt(c.text)}${second}`;
  }).join("\n\n") + "\n";
}

// ── Cache (optional private bucket) ──────────────────────────────────────────
const storageUrl = (key: string) => `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/${BUCKET}/${key}`;
const storageAuth = () => ({ Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}` });

async function cacheGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(storageUrl(key), { headers: storageAuth() });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}
async function cachePut(key: string, body: string) {
  try {
    await fetch(storageUrl(key), {
      method: "POST",
      headers: { ...storageAuth(), "Content-Type": "text/plain; charset=utf-8", "x-upsert": "true" },
      body,
    });
  } catch { /* the cache is optional */ }
}

// ── Router ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  // The path arrives as /stremio-addon/<cfg>/… (or /functions/v1/stremio-addon/…).
  const path = url.pathname.replace(/^.*?\/stremio-addon/, "").replace(/^\/+/, "");
  const [cfg, ...rest] = path.split("/");

  if (!cfg || cfg === "configure" || rest[0] === "configure") {
    return Response.redirect(`${SITE}/stremio`, 302);
  }
  const conf = parseConfig(cfg);
  if (!conf) return json({ error: "Use /<learn>-<native>/manifest.json, e.g. /fr-en/manifest.json" }, 60);
  const { learn, native } = conf;

  try {
    if (rest[0] === "manifest.json") return json(manifest(cfg, learn, native), 86400);

    if (rest[0] === "subtitles" && rest.length >= 3) {
      const type = rest[1];
      const id = decodeURIComponent(rest[2].replace(/\.json$/, ""));
      const extra = new URLSearchParams(rest[3] ? decodeURIComponent(rest[3].replace(/\.json$/, "")) : "");
      if (!["movie", "series"].includes(type) || !/^tt\d+(:\d+:\d+)?$/.test(id)) return json({ subtitles: [] });
      const found = await searchSubtitles(id, learn, extra);
      const base = `${url.origin}${url.pathname.slice(0, url.pathname.indexOf("/stremio-addon") + "/stremio-addon".length)}/${cfg}`;
      return json({
        subtitles: found.map((f, i) => ({
          id: `ls-${cfg}-${f.fileId}`,
          url: `${base}/sub/${f.fileId}.srt`,
          lang: `LinguaScript ${NAMES[learn]} + ${NAMES[native]}${i ? ` (${i + 1})` : ""}`,
        })),
        cacheMaxAge: 6 * 3600,
      }, 6 * 3600);
    }

    if (rest[0] === "sub" && /^\d+\.srt$/.test(rest[1] || "")) {
      const fileId = Number(rest[1].replace(".srt", ""));
      const key = `${cfg}/${fileId}.srt`;
      let body = await cacheGet(key);
      if (!body) {
        body = await makeDual(await downloadSubtitle(fileId), learn, native);
        await cachePut(key, body);
      }
      return new Response(body, {
        headers: { ...cors, "Content-Type": "application/x-subrip; charset=utf-8", "Cache-Control": "public, max-age=604800" },
      });
    }

    return json({ error: "Not found" }, 60);
  } catch (e) {
    console.error("stremio-addon", e);
    // Stremio shows nothing rather than an error, so an empty list keeps it calm.
    if (rest[0] === "subtitles") return json({ subtitles: [] }, 300);
    return new Response("Subtitles are not available right now.", { status: 502, headers: cors });
  }
});
