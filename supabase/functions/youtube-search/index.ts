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

// YouTube's own video category taxonomy — "Music" (10) is what let songs
// slip past every other filter (captions = lyrics, engagement is high,
// duration can land in-band). None of that makes a song a listening lesson.
const EXCLUDED_CATEGORY_IDS = new Set(["10"]);

// "Comprehensible input" is a real pedagogical genre (Krashen's input
// hypothesis) but not a real YouTube taxonomy field — there's no tag to
// query. Creators in this genre consistently self-label it in the title/
// channel name, so a keyword match is the practical proxy.
const CI_KEYWORD_RE = /(comprehensible input|comprehensible |input hypothesis|krashen|niveau facile|langsam gesprochen)/i;

// Starter allowlist of known comprehensible-input-style channels, matched
// case-insensitively as a substring of the channel title. UNVERIFIED — a
// best-effort list from general knowledge of the genre, not confirmed
// against current live channel names. Swap/extend freely; this is meant to
// be edited, not treated as authoritative.
const CI_CHANNELS: Record<string, string[]> = {
  es: ["dreaming spanish", "spanishland school", "comprehensible spanish"],
  fr: ["french mornings with elisa", "comprehensible french"],
  de: ["easy german", "deutsch für euch", "comprehensible german"],
  ja: ["comprehensible japanese", "japanese immersion"],
  ru: ["comprehensible russian"],
  it: ["comprehensible italian", "italiano automatico"],
  pt: ["comprehensible portuguese"],
  zh: ["comprehensible chinese", "mandarin corner"],
};

function isComprehensibleInput(title: string, channel: string, lang: string): boolean {
  const t = `${title} ${channel}`.toLowerCase();
  if (CI_KEYWORD_RE.test(t)) return true;
  const known = CI_CHANNELS[(lang || "").toLowerCase()] || [];
  return known.some((name) => channel.toLowerCase().includes(name));
}

// Duration band: 8–15 minutes. Long enough to be a real lesson (not a
// vlog fragment), short enough to finish in one sitting — "one video a
// day" only works as a habit if that video is a 10-ish minute commitment,
// not a 40-minute lecture. Center of the band (~600s) scores best.
const MIN_DURATION_SECONDS = 8 * 60;
const MAX_DURATION_SECONDS = 15 * 60;
const IDEAL_DURATION_SECONDS = 10 * 60;

// Below this, a video's "popularity" is noise, not signal — could be brand
// new or just obscure. Raised from 500: that floor let real junk through.
const MIN_VIEW_COUNT = 5000;

// Raw view count rewards whatever language already has the most YouTube
// content (English, Spanish) over well-made niche content in a smaller
// language. Like/view ratio is a much fairer quality signal: it asks "did
// the people who watched this actually rate it," not "is this language
// popular." A ratio this low is a real spam/low-effort signal in either case.
const MIN_ENGAGEMENT_RATIO = 0.004;

function qualityScore(it: {
  title: string;
  channel: string;
  viewCount: number;
  likeCount: number;
  durationSeconds: number;
  audioLang: string;
}, lang: string): number {
  const engagementRatio = it.viewCount > 0 ? it.likeCount / it.viewCount : 0;
  const durationCloseness = 1 - Math.min(1, Math.abs(it.durationSeconds - IDEAL_DURATION_SECONDS) / IDEAL_DURATION_SECONDS);
  const ciBoost = isComprehensibleInput(it.title || "", it.channel || "", lang) ? 1 : 0;
  // Weighted so CI content wins ties decisively, engagement quality matters
  // more than exact duration, and nothing so extreme one factor alone
  // dominates every other signal.
  return engagementRatio * 100 + durationCloseness * 3 + ciBoost * 5;
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
      categoryId: string;
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
              categoryId: item.snippet?.categoryId || "",
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
        categoryId: m?.categoryId || "",
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
    //  - outside the 8-15 min band -> not a Short, but also not a one-sitting
    //    daily-habit video (too short = fragment, too long = lecture)
    //  - made-for-kids -> wrong register/pacing for an adult learner
    //  - Music category -> a song, not a listening lesson, however well it
    //    otherwise scores (captions=lyrics, high engagement, in-band length)
    //  - below the view floor, OR essentially no engagement relative to its
    //    view count -> spam/low-effort filter that doesn't penalize niche
    //    languages the way a raw view-count filter would
    items = items.filter((it: any) =>
      it.hasCaptions &&
      it.durationSeconds >= MIN_DURATION_SECONDS &&
      it.durationSeconds <= MAX_DURATION_SECONDS &&
      !it.madeForKids &&
      !EXCLUDED_CATEGORY_IDS.has(it.categoryId) &&
      it.viewCount >= MIN_VIEW_COUNT &&
      (it.viewCount > 0 ? it.likeCount / it.viewCount >= MIN_ENGAGEMENT_RATIO : false),
    );

    // Best candidates first: only the top `maxToScore` (10, in
    // rankByComprehension) ever get their captions fetched for real
    // comprehension scoring, so quality/CI/duration-fit needs to decide
    // what makes that cut, not just search relevance order.
    items.sort((a: any, b: any) => qualityScore(b, lang) - qualityScore(a, lang));

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
