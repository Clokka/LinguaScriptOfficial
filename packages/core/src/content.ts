import type { LinguaScriptSupabaseClient } from './supabase';

export interface FilmRow {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  url?: string | null;
  language: string | null;
  cefr_level?: string | null;
  duration_seconds?: number | null;
  category?: string | null;
  description?: string | null;
}

const FILM_COLUMNS =
  'id, title, thumbnail_url, url, language, cefr_level, duration_seconds, category, description';

export async function fetchDiscoverRail(
  client: LinguaScriptSupabaseClient,
  language: string,
  limit = 20,
): Promise<FilmRow[]> {
  const { data, error } = await client
    .from('films')
    .select(FILM_COLUMNS)
    .eq('language', language)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('fetchDiscoverRail', error);
    return [];
  }
  return (data as unknown as FilmRow[]) ?? [];
}

export async function fetchContinueWatching(
  client: LinguaScriptSupabaseClient,
  userId: string,
  language: string,
  limit = 10,
): Promise<FilmRow[]> {
  const { data, error } = await client
    .from('watch_sessions')
    .select(`film_id, watched_at, films!inner(${FILM_COLUMNS})`)
    .eq('user_id', userId)
    .eq('language', language)
    .order('watched_at', { ascending: false })
    .limit(limit * 2);
  if (error || !data) return [];
  const seen = new Set<string>();
  const rows: FilmRow[] = [];
  for (const r of data as any[]) {
    const f = r.films as FilmRow | null;
    if (!f || !f.id || seen.has(f.id)) continue;
    seen.add(f.id);
    rows.push(f);
    if (rows.length >= limit) break;
  }
  return rows;
}
