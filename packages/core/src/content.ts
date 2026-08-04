import type { LinguaScriptSupabaseClient } from './supabase';

export interface FilmRow {
  id: string;
  title: string;
  poster_url?: string | null;
  youtube_id?: string | null;
  language: string;
  cefr_level?: string | null;
  duration_seconds?: number | null;
  category?: string | null;
  description?: string | null;
}

export async function fetchDiscoverRail(
  client: LinguaScriptSupabaseClient,
  language: string,
  limit = 20,
): Promise<FilmRow[]> {
  const { data, error } = await client
    .from('films')
    .select(
      'id, title, poster_url, youtube_id, language, cefr_level, duration_seconds, category, description',
    )
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('fetchDiscoverRail', error);
    return [];
  }
  return (data as FilmRow[]) || [];
}

export async function fetchContinueWatching(
  client: LinguaScriptSupabaseClient,
  userId: string,
  language: string,
  limit = 10,
): Promise<FilmRow[]> {
  const { data, error } = await (client as any)
    .from('watch_sessions')
    .select('film_id, updated_at, films(id, title, poster_url, youtube_id, language, cefr_level, duration_seconds, category, description)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const seen = new Set<string>();
  const rows: FilmRow[] = [];
  for (const r of data as any[]) {
    const f = r.films;
    if (!f || f.language !== language || seen.has(f.id)) continue;
    seen.add(f.id);
    rows.push(f as FilmRow);
  }
  return rows;
}
