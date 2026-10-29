export interface VideoPopularity {
  viewCount?: number;
  likeCount?: number;
}

/** Real audience signals, not a pedagogical genre or guessed CEFR level.
 * A logarithmic audience term limits viral outliers; the smoothed ratio
 * stops tiny audiences with a handful of likes dominating the shortlist.
 */
export function popularityScore(video: VideoPopularity): number {
  const views = Math.max(0, video.viewCount ?? 0);
  const likes = Math.min(views, Math.max(0, video.likeCount ?? 0));
  if (!views) return 0;
  return Math.log10(1 + views) + 100 * likes / (views + 1000);
}