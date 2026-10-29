/** Run with bun scripts/seed-hobby-catalog.ts. Private keys stay in env.
 * Verified candidate metadata only: this never fabricates captions or
 * treats a search-language hint as proof of spoken language.
 */
import { createClient } from "@supabase/supabase-js";
import { INTERESTS } from "../src/lib/interests";
import { popularityScore } from "../src/lib/videoPopularity";

const key = process.env.YOUTUBE_API_KEY;
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !url || !serviceKey) throw new Error("Catalog credentials unavailable");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const fr: Record<string, string> = {
  gaming: "jeux vidéo gameplay français", football: "football analyse français", fitness: "musculation entraînement français",
  travel: "voyage échappées belles france", cooking: "recette cuisine français", music: "musique interview artiste français",
  films: "cinéma critique film français", comedy: "humour sketch français", history: "histoire documentaire français",
  business: "économie entreprise français", news: "actualité reportage france info", podcasts: "podcast interview français",
  cars: "automobile essai français", art: "art dessin peinture français", culture: "culture reportage français",
  language: "apprentissage langues témoignage français", tech: "test smartphone français",
  entrepreneurship: "entrepreneur réussite entreprise français", anime: "anime analyse français",
};
const report: { language: string; hobby: string; stored: number; reason?: string }[] = [];
let quotaExhausted = false;
async function youtube(path: string, params: Record<string, string>) {
  const endpoint = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  endpoint.search = new URLSearchParams({ ...params, key }).toString();
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!response.ok) {
    const reason = body.error?.errors?.[0]?.reason ?? "upstream";
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") quotaExhausted = true;
    throw new Error(reason);
  }
  return body;
}
function seconds(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}
for (const language of ["fr", "en"]) {
  for (const hobby of INTERESTS) {
    if (quotaExhausted) { report.push({ language, hobby: hobby.id, stored: 0, reason: "quota" }); continue; }
    try {
      const { data: existing } = await db.from("hobby_video_catalog").select("*").eq("language", language).eq("hobby", hobby.id);
      if ((existing?.length ?? 0) >= 10) { report.push({ language, hobby: hobby.id, stored: 10 }); continue; }
      const q = language === "fr" ? fr[hobby.id] : hobby.id === "entrepreneurship" ? "entrepreneur business success story" : hobby.query;
      const search = await youtube("search", { part: "snippet", q, type: "video", maxResults: "50", order: "viewCount", relevanceLanguage: language, videoEmbeddable: "true", videoDuration: "medium" });
      const ids = search.items.map((v: any) => v.id.videoId).filter(Boolean).join(",");
      if (!ids) { report.push({ language, hobby: hobby.id, stored: 0, reason: "no_candidates" }); continue; }
      const metadata = await youtube("videos", { part: "snippet,statistics,contentDetails,status", id: ids });
      const candidates = metadata.items.map((v: any) => ({
        language, hobby: hobby.id, video_id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle,
        thumbnail_url: v.snippet.thumbnails?.medium?.url ?? null,
        duration_seconds: seconds(v.contentDetails.duration),
        view_count: Number(v.statistics.viewCount ?? 0),
        like_count: v.statistics.likeCount === undefined ? null : Number(v.statistics.likeCount),
        audio_language: v.snippet.defaultAudioLanguage ?? "",
        stats_checked_at: new Date().toISOString(),
        allowed: v.status.embeddable !== false && !v.status.madeForKids,
      })).filter((v: any) => v.allowed && v.duration_seconds > 0 && v.duration_seconds <= 1200 && v.audio_language.split("-")[0] === language && v.view_count >= 1000);
      candidates.sort((a: any, b: any) => popularityScore({ viewCount: b.view_count, likeCount: b.like_count }) - popularityScore({ viewCount: a.view_count, likeCount: a.like_count }));
      const combined = new Map<string, any>((existing ?? []).map((row) => [row.video_id, row]));
      for (const { allowed, ...row } of candidates) combined.set(row.video_id, row);
      const rows = [...combined.values()].sort((a, b) => popularityScore({ viewCount: b.view_count, likeCount: b.like_count }) - popularityScore({ viewCount: a.view_count, likeCount: a.like_count })).slice(0, 10);
      if (rows.length) {
        const { error } = await db.from("hobby_video_catalog").upsert(rows, { onConflict: "language,hobby,video_id" });
        if (error) throw new Error("catalog_write_failed");
      }
      report.push({ language, hobby: hobby.id, stored: rows.length, ...(rows.length < 10 ? { reason: "insufficient_verified_audio_candidates" } : {}) });
      console.log(language, hobby.id, rows.length);
    } catch (error) {
      report.push({ language, hobby: hobby.id, stored: 0, reason: error instanceof Error ? error.message : "unavailable" });
    }
  }
}
await Bun.write("/tmp/catalog/seed-report.json", JSON.stringify(report, null, 2));
console.log("Verified candidates", report.reduce((sum, row) => sum + row.stored, 0), "complete hobby/language pairs", report.filter((row) => row.stored === 10).length);