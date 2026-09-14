// Shared "is this actually a good daily-lesson video" policy for every
// surface that shows admin-curated `films` rows (Discover, Home catalog
// rows, the paste-a-link library). The live YouTube search edge function
// (supabase/functions/youtube-search) already enforces an 8-15 min band and
// drops the Music category server-side for its own candidates; this is the
// same idea applied to curated catalog content, which comes from the Admin
// dashboard instead and was never filtered — so a 60-minute lecture or a
// song added there would slip straight onto Discover/Home.
//
// The catalog cap is looser than the live-search band because admin-curated
// content is hand-picked, not algorithmically guessed. The original 20-minute
// cap turned out to be far stricter than the real catalog: most of the
// existing admin-curated library (vlogs, interviews, documentary-style
// lessons) already ran longer than that, so the very first rollout of this
// filter silently emptied Discover and the Home rows on every page that uses
// it. A 60-minute lecture or a full movie is still cut, but the cap now
// leaves normal-length lesson content alone.
export const MAX_LESSON_SECONDS = 45 * 60;
export const MIN_LESSON_SECONDS = 2 * 60;
export const IDEAL_LESSON_SECONDS = 12 * 60;

export function isMusicCategory(category?: string | null, tags?: string[] | null): boolean {
  if (category && /music/i.test(category)) return true;
  if (tags?.some((t) => /music/i.test(t))) return true;
  return false;
}

/** No duration on file (admin left it blank) passes through — absence isn't evidence of a violation. */
export function isWithinLessonLength(durationSeconds?: number | null): boolean {
  if (!durationSeconds || durationSeconds <= 0) return true;
  return durationSeconds >= MIN_LESSON_SECONDS && durationSeconds <= MAX_LESSON_SECONDS;
}

export function passesContentLengthPolicy(film: {
  category?: string | null;
  tags?: string[] | null;
  duration_seconds?: number | null;
}): boolean {
  return !isMusicCategory(film.category, film.tags) && isWithinLessonLength(film.duration_seconds);
}
