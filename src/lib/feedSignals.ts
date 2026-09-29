import { supabase } from "@/integrations/supabase/client";

export type FeedEventKind = "open" | "half" | "complete" | "save";

/** Weighted taste signal for an interest (open 1, half 2, complete 3, save 2). */
export async function recordFeedEvent(interestId: string, language: string, kind: FeedEventKind) {
  try {
    await (supabase as any).rpc("record_feed_event", {
      _interest_id: interestId,
      _language: language.toLowerCase(),
      _kind: kind,
    });
  } catch { /* never block playback on a signal write */ }
}

/** Which interest row (if any) a YouTube video was opened from. */
export function feedSourceFor(videoId?: string | null): { interest: string; lang: string } | null {
  if (!videoId) return null;
  try {
    const raw = sessionStorage.getItem(`feed:src:${videoId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
