import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Convert ISO 8601 duration (e.g. PT4M13S) -> total seconds.
 */
function isoDurationToSeconds(iso: string | undefined | null): number {
  if (!iso) return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}

/**
 * V1 difficulty heuristic — purely from metadata so we don't burn quota.
 * < 4 min  → beginner (vlogs, songs, short skits)
 * 4–12 min → intermediate (most YouTube content)
 * > 12 min → advanced (long-form, debates, lectures)
 * News/debate keywords bump difficulty up; "for beginners / kids / slow" bumps down.
 */
function estimateDifficulty(title: string, channel: string, seconds: number): "beginner" | "intermediate" | "advanced" {
  const t = `${title} ${channel}`.toLowerCase();
  if (/(for beginners|beginner|a1|a2|easy|slow|kids|enfant|niños)/i.test(t)) return "beginner";
  if (/(debate|news|journal|política|politique|politics|interview|conference|lecture)/i.test(t)) return "advanced";
  if (seconds < 4 * 60) return "beginner";
  if (seconds < 12 * 60) return "intermediate";
  return "advanced";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { q, lang } = await req.json();
    if (!q || typeof q !== "string") {
      return new Response(JSON.stringify({ error: "Missing q" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) search.list
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "20");
    searchUrl.searchParams.set("videoEmbeddable", "true");
    if (lang) searchUrl.searchParams.set("relevanceLanguage", lang);
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString());
    const searchData = await searchRes.json();
    if (!searchRes.ok) {
      return new Response(JSON.stringify({ error: searchData?.error?.message || "YouTube error" }), {
        status: searchRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = (searchData.items || [])
      .map((it: any) => ({
        videoId: it.id?.videoId,
        title: it.snippet?.title,
        channel: it.snippet?.channelTitle,
        thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url,
        publishedAt: it.snippet?.publishedAt,
      }))
      .filter((x: any) => x.videoId);

    // 2) videos.list for contentDetails (duration + caption availability),
    // statistics (view/like counts) and status (madeForKids) — everything
    // needed to filter Shorts, junk and caption-less videos without ever
    // fetching a caption track (that step is scored client-side, for free,
    // against the specific learner's own vocabulary).
    let meta = new Map<string, {
      seconds: number;
      audioLang: string;
      hasCaptions: boolean;
      viewCount: number;
      likeCount: number;
      madeForKids: boolean;
      definition: string;
    }>();
    if (base.length) {
      const idsCsv = base.map((b: any) => b.videoId).join(",");
      const vidUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      vidUrl.searchParams.set("part", "contentDetails,snippet,statistics,status");
      vidUrl.searchParams.set("id", idsCsv);
      vidUrl.searchParams.set("key", apiKey);
      try {
        const vidRes = await fetch(vidUrl.toString());
        if (vidRes.ok) {
          const vidData = await vidRes.json();
          for (const item of vidData.items || []) {
            const al = item.snippet?.defaultAudioLanguage || item.snippet?.defaultLanguage || "";
            meta.set(item.id, {
              seconds: isoDurationToSeconds(item.contentDetails?.duration),
              audioLang: al ? String(al).toLowerCase() : "",
              hasCaptions: item.contentDetails?.caption === "true",
              viewCount: parseInt(item.statistics?.viewCount || "0", 10),
              likeCount: parseInt(item.statistics?.likeCount || "0", 10),
              madeForKids: !!item.status?.madeForKids,
              definition: item.contentDetails?.definition || "sd",
            });
          }
        }
      } catch (_) { /* non-fatal */ }
    }

    const langPrefix = (lang || "").toLowerCase().slice(0, 2);

    let items = base.map((b: any) => {
      const m = meta.get(b.videoId);
      const seconds = m?.seconds || 0;
      return {
        ...b,
        durationSeconds: seconds,
        audioLang: m?.audioLang || "",
        hasCaptions: m?.hasCaptions ?? false,
        viewCount: m?.viewCount ?? 0,
        likeCount: m?.likeCount ?? 0,
        madeForKids: m?.madeForKids ?? false,
        definition: m?.definition || "sd",
        difficulty: estimateDifficulty(b.title || "", b.channel || "", seconds),
      };
    });

    // Language purity: when YouTube tells us a video's audio language and it
    // doesn't match the learner's target, drop it. We keep videos with no
    // declared language (most of YouTube) and rely on relevanceLanguage there.
    if (langPrefix) {
      items = items.filter((it: any) => !it.audioLang || it.audioLang.startsWith(langPrefix));
    }

    // Quality floor, applied server-side so quota isn't wasted scoring junk:
    //  - no captions at all -> can't be scored or dual-subtitled, drop it
    //  - under 3 minutes -> almost certainly a Short, not a lesson
    //  - made-for-kids -> wrong register/pacing for an adult learner
    //  - essentially no engagement -> spam/low-effort filter
    items = items.filter((it: any) =>
      it.hasCaptions &&
      it.durationSeconds >= 180 &&
      !it.madeForKids &&
      it.viewCount >= 500,
    );

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
