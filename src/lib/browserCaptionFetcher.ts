/**
 * Browser-side YouTube caption fetcher — DownSub-style.
 * All YouTube requests come from the user's browser (residential IP).
 * Supabase is NEVER used to contact YouTube.
 */

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

function decodeHtml(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value.replace(/\s+/g, " ").trim();
}

/** Parse YouTube's XML caption format (srv3 / timedtext) */
function parseTimedTextXml(xml: string): SubtitleSegment[] {
  const subs: SubtitleSegment[] = [];

  // Format 1: <text start="..." dur="...">
  const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = textRegex.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const dur = parseFloat(m[2]);
    const text = decodeHtml(m[3].replace(/<[^>]+>/g, ""));
    if (text) subs.push({ start, end: start + dur, text });
  }
  if (subs.length > 0) return subs;

  // Format 2: <p t="..." d="...">
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = pRegex.exec(xml)) !== null) {
    const start = parseInt(m[1]) / 1000;
    const dur = parseInt(m[2]) / 1000;
    const text = decodeHtml(m[3].replace(/<[^>]+>/g, ""));
    if (text) subs.push({ start, end: start + dur, text });
  }
  return subs;
}

/** Parse JSON3 caption format */
function parseJson3(json: any): SubtitleSegment[] {
  const subs: SubtitleSegment[] = [];
  const events = json?.events || [];
  for (const event of events) {
    if (!event.segs || event.tStartMs === undefined) continue;
    const text = event.segs.map((s: any) => s.utf8 || "").join("").trim();
    if (!text || text === "\n") continue;
    const start = event.tStartMs / 1000;
    const end = (event.tStartMs + (event.dDurationMs || 3000)) / 1000;
    subs.push({ start, end, text: decodeHtml(text) });
  }
  return subs;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string };
}

/**
 * Step 1: Call InnerTube player endpoint FROM THE BROWSER
 * to extract captionTracks[].
 */
async function getInnerTubeCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const payload = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20240101.00.00",
        hl: "en",
        gl: "US",
      },
    },
    videoId,
  };

  try {
    console.log("[BrowserCaptions] Fetching InnerTube player for", videoId);
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!res.ok) {
      console.warn("[BrowserCaptions] InnerTube returned", res.status);
      return [];
    }

    const data = await res.json();
    const tracks: CaptionTrack[] =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    console.log(`[BrowserCaptions] Found ${tracks.length} caption tracks`);
    return tracks;
  } catch (e) {
    console.warn("[BrowserCaptions] InnerTube error:", e);
    return [];
  }
}

/**
 * Step 2: Download caption XML/JSON for a specific language.
 * Uses &tlang= to force YouTube auto-translate if needed.
 */
async function downloadCaptionTrack(
  baseUrl: string,
  targetLang: string,
  isBaseLanguage: boolean
): Promise<SubtitleSegment[]> {
  const formats = ["json3", "srv3"];

  for (const fmt of formats) {
    try {
      let url = baseUrl;
      if (!isBaseLanguage) {
        url += `&tlang=${targetLang}`;
      }
      url += `&fmt=${fmt}`;

      console.log(`[BrowserCaptions] Downloading fmt=${fmt}, tlang=${isBaseLanguage ? "none" : targetLang}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;

      if (fmt === "json3") {
        try {
          const json = await res.json();
          const subs = parseJson3(json);
          if (subs.length > 0) {
            console.log(`[BrowserCaptions] Parsed ${subs.length} subs via json3`);
            return subs;
          }
        } catch {
          // not valid JSON
        }
      } else {
        const content = await res.text();
        if (content.length > 50) {
          const subs = parseTimedTextXml(content);
          if (subs.length > 0) {
            console.log(`[BrowserCaptions] Parsed ${subs.length} subs via ${fmt}`);
            return subs;
          }
        }
      }
    } catch (e) {
      console.warn(`[BrowserCaptions] ${fmt} error:`, e);
    }
  }
  return [];
}

/**
 * Main entry: fetch both learning + native language tracks from the browser.
 * 100% browser-side. No server/edge function involved.
 */
export async function fetchCaptionsFromBrowser(
  videoId: string,
  learningLang: string,
  nativeLang: string
): Promise<{ learning: SubtitleSegment[]; native: SubtitleSegment[] }> {
  const tracks = await getInnerTubeCaptionTracks(videoId);

  if (tracks.length === 0) {
    console.warn("[BrowserCaptions] No caption tracks available");
    return { learning: [], native: [] };
  }

  // Log available tracks
  for (const t of tracks) {
    console.log(`[BrowserCaptions] Track: ${t.languageCode} (kind: ${t.kind || "standard"})`);
  }

  // Find best base track
  const exactLearning = tracks.find((t) => t.languageCode === learningLang);
  const exactNative = tracks.find((t) => t.languageCode === nativeLang);
  const baseTrack = exactLearning || exactNative || tracks[0];

  console.log(`[BrowserCaptions] Using base track: ${baseTrack.languageCode}`);

  let learning: SubtitleSegment[] = [];
  let native: SubtitleSegment[] = [];

  // Fetch learning language
  if (baseTrack.languageCode === learningLang) {
    learning = await downloadCaptionTrack(baseTrack.baseUrl, learningLang, true);
  } else {
    learning = await downloadCaptionTrack(baseTrack.baseUrl, learningLang, false);
  }

  // Fetch native language
  if (baseTrack.languageCode === nativeLang) {
    native = await downloadCaptionTrack(baseTrack.baseUrl, nativeLang, true);
  } else if (exactNative) {
    native = await downloadCaptionTrack(exactNative.baseUrl, nativeLang, true);
  } else {
    native = await downloadCaptionTrack(baseTrack.baseUrl, nativeLang, false);
  }

  console.log(`[BrowserCaptions] Final: learning=${learning.length}, native=${native.length}`);
  return { learning, native };
}
