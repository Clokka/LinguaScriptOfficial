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
//   /<cfg>/sub/<source>.srt   → the dual subtitle file itself
//
// Same pieces as the rest of LinguaScript, no extra keys:
//   • Source subtitles: Stremio's own public OpenSubtitles v3 add-on (the
//     "OpenSubtitles v3" entry learners already see in Stremio). Only its
//     strem.io file hosts are ever fetched.
//   • public.caption_cache (shared with fetch-captions): parsed source lines,
//     video_id "stremio:<hash>", checked with subtitlesLookLikeWrongLanguage.
//   • googleTranslateMany (_shared/dictionary.ts): the second line.
//   • Private storage bucket "stremio-subs" (docs/sql/stremio-addon.sql):
//     the finished dual .srt, so each episode is translated once.
// Deck colours (red/orange/green words) need a personal key: see
// docs/MEDIA_COMPATIBILITY.md, phase 2.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { googleTranslateMany } from "../_shared/dictionary.ts";
import { subtitlesLookLikeWrongLanguage } from "../_shared/scriptCheck.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const SOURCE_ADDON = "https://opensubtitles-v3.strem.io";
const SITE = "https://linguascript.co.uk";
const BUCKET = "stremio-subs";

const NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese", ja: "Japanese",
  ko: "Korean", zh: "Chinese", ru: "Russian", ar: "Arabic", nl: "Dutch", pl: "Polish", sv: "Swedish",
  tr: "Turkish", hi: "Hindi", th: "Thai",
};
// Stremio labels subtitle languages with ISO 639-2 codes.
const ISO3: Record<string, string[]> = {
  en: ["eng"], es: ["spa", "spn", "ea"], fr: ["fre", "fra"], de: ["ger", "deu"], it: ["ita"], pt: ["por", "pob", "pt-br"],
  ja: ["jpn"], ko: ["kor"], zh: ["chi", "zho", "zht", "zhe"], ru: ["rus"], ar: ["ara"], nl: ["dut", "nld"],
  pl: ["pol"], sv: ["swe"], tr: ["tur"], hi: ["hin"], th: ["tha"],
};

interface Sub { start: number; end: number; text: string }

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
    version: "1.1.0",
    name: `LinguaScript ${learn.toUpperCase()}+${native.toUpperCase()}`,
    description: `${NAMES[learn]} subtitles with ${NAMES[native]} underneath, for learning ${NAMES[learn]} with films, series and anime. From LinguaScript.`,
    logo: `${SITE}/logo.svg`,
    resources: ["subtitles"],
    types: ["movie", "series"],
    idPrefixes: ["tt", "kitsu"],
    catalogs: [],
    behaviorHints: { configurable: true },
  };
}

// ── Source: Stremio's public OpenSubtitles v3 add-on ─────────────────────────
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

/** Only Stremio's own subtitle hosts — never an open proxy. */
function allowedSource(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "strem.io" || u.hostname.endsWith(".strem.io"));
  } catch { return false; }
}

async function findSources(type: string, id: string, extra: string, learn: string): Promise<string[]> {
  const path = `${SOURCE_ADDON}/subtitles/${type}/${id}${extra ? `/${extra}` : ""}.json`;
  const res = await fetch(path, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`OpenSubtitles v3 ${res.status}`);
  const data = await res.json();
  const want = new Set([learn, ...(ISO3[learn] || [])]);
  return (data?.subtitles || [])
    .filter((s: { lang?: string; url?: string }) => want.has(String(s.lang || "").toLowerCase()) && allowedSource(String(s.url || "")))
    .map((s: { url: string }) => s.url)
    .slice(0, 3);
}

// ── Subtitles in and out ─────────────────────────────────────────────────────
function toSeconds(raw: string) {
  const m = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})/.exec(raw);
  if (!m) return NaN;
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
}

/** SRT or WebVTT → lines (same shape as fetch-captions / caption_cache). */
function parseSubs(text: string): Sub[] {
  return text.replace(/^﻿/, "").replace(/\r/g, "").split(/\n{2,}/).flatMap((block) => {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) return [];
    const [a, b] = lines[i].split("-->");
    const start = toSeconds(a), end = toSeconds(b);
    const body = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
    return !isNaN(start) && !isNaN(end) && body ? [{ start, end, text: body }] : [];
  });
}

function srtTime(sec: number) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}
const escapeSrt = (s: string) => s.replace(/</g, "‹").replace(/>/g, "›");

/** Learning-language line on top, the learner's own language smaller and grey underneath. */
async function makeDual(subs: Sub[], learn: string, native: string): Promise<string> {
  let translated: string[] = [];
  try { translated = await googleTranslateMany(subs.map((s) => s.text), learn, native); } catch (e) { console.error("translate failed", e); }
  return subs.map((s, i) => {
    const tr = translated[i]?.trim();
    const second = tr && tr.toLowerCase() !== s.text.toLowerCase() ? `\n<font color="#B8B8C0"><i>${escapeSrt(tr)}</i></font>` : "";
    return `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${escapeSrt(s.text)}${second}`;
  }).join("\n\n") + "\n";
}

// ── Shared caches ────────────────────────────────────────────────────────────
function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

async function sha(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The source lines, from caption_cache or downloaded once and stored there. */
async function sourceSubs(db: SupabaseClient | null, url: string, learn: string): Promise<Sub[]> {
  const videoId = `stremio:${await sha(url)}`;
  if (db) {
    const { data } = await db.from("caption_cache").select("subtitles").eq("video_id", videoId).eq("language", learn).maybeSingle();
    if (Array.isArray(data?.subtitles) && data.subtitles.length) return data.subtitles as Sub[];
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Subtitle file ${res.status}`);
  const subs = parseSubs(await res.text());
  if (!subs.length) throw new Error("Empty subtitle file");
  if (subtitlesLookLikeWrongLanguage(subs, learn)) throw new Error(`Track is not in ${learn}`);
  if (db) {
    const { error } = await db.from("caption_cache")
      .upsert({ video_id: videoId, language: learn, subtitles: subs, source: "stremio-opensubtitles-v3" }, { onConflict: "video_id,language" });
    if (error) console.log("caption_cache write failed:", error.message);
  }
  return subs;
}

async function bucketGet(db: SupabaseClient | null, key: string): Promise<string | null> {
  if (!db) return null;
  const { data } = await db.storage.from(BUCKET).download(key).catch(() => ({ data: null }));
  return data ? await data.text() : null;
}
async function bucketPut(db: SupabaseClient | null, key: string, body: string) {
  if (!db) return;
  const { error } = await db.storage.from(BUCKET)
    .upload(key, new Blob([body], { type: "text/plain" }), { upsert: true, contentType: "text/plain; charset=utf-8" })
    .catch((e) => ({ error: e }));
  if (error) console.log("stremio-subs write failed (run docs/sql/stremio-addon.sql):", error.message ?? error);
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
      const extra = rest[3] ? rest[3].replace(/\.json$/, "") : "";
      if (!["movie", "series"].includes(type) || !/^(tt\d+|kitsu:\d+)(:\d+){0,2}$/.test(id)) return json({ subtitles: [] });
      const sources = await findSources(type, id, extra, learn);
      const base = `${url.origin}${url.pathname.slice(0, url.pathname.indexOf("/stremio-addon") + "/stremio-addon".length)}/${cfg}`;
      return json({
        subtitles: sources.map((src, i) => ({
          id: `ls-${cfg}-${i}`,
          url: `${base}/sub/${b64url(src)}.srt`,
          lang: `LinguaScript ${NAMES[learn]} + ${NAMES[native]}${i ? ` (${i + 1})` : ""}`,
        })),
        cacheMaxAge: 6 * 3600,
      }, 6 * 3600);
    }

    if (rest[0] === "sub" && /^[A-Za-z0-9_-]+\.srt$/.test(rest[1] || "")) {
      let src = "";
      try { src = unb64url(rest[1].replace(/\.srt$/, "")); } catch { /* bad link */ }
      if (!allowedSource(src)) return new Response("Unknown subtitle source", { status: 400, headers: cors });
      const db = serviceClient();
      const key = `${cfg}/${await sha(src)}.srt`;
      let body = await bucketGet(db, key);
      if (!body) {
        body = await makeDual(await sourceSubs(db, src, learn), learn, native);
        await bucketPut(db, key, body);
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
