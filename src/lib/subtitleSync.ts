import { supabase } from "@/integrations/supabase/client";
import { getLanguageLabel } from "@/lib/languages";

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

function mapRowsToSegments(rows: Array<{ start_time: number; end_time: number; text: string }>): SubtitleSegment[] {
  return rows.map((row) => ({
    start: row.start_time,
    end: row.end_time,
    text: row.text,
  }));
}

export async function loadStoredSubtitleTracks(
  filmId: string,
  primaryLanguage: string,
  secondaryLanguage: string,
) {
  const [primaryRes, secondaryRes] = await Promise.all([
    supabase
      .from("subtitles")
      .select("start_time, end_time, text")
      .eq("film_id", filmId)
      .eq("language", primaryLanguage)
      .order("sort_order", { ascending: true }),
    supabase
      .from("subtitles")
      .select("start_time, end_time, text")
      .eq("film_id", filmId)
      .eq("language", secondaryLanguage)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    primary: mapRowsToSegments(primaryRes.data || []),
    secondary: mapRowsToSegments(secondaryRes.data || []),
  };
}

export async function fetchSubtitleTrackFromBackend(
  videoId: string,
  language: string,
): Promise<SubtitleSegment[]> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-captions", {
      body: { videoId, language },
    });

    if (error || !data?.subtitles?.length) {
      return [];
    }

    return data.subtitles.map((subtitle: any) => ({
      start: subtitle.start,
      end: subtitle.end,
      text: subtitle.text,
    }));
  } catch {
    return [];
  }
}

export async function translateSubtitleTrack(
  subtitles: SubtitleSegment[],
  fromLanguage: string,
  toLanguage: string,
): Promise<SubtitleSegment[]> {
  if (!subtitles.length || fromLanguage === toLanguage) {
    return [];
  }

  try {
    const { data, error } = await supabase.functions.invoke("translate-subtitles", {
      body: {
        subtitles,
        fromLanguage: getLanguageLabel(fromLanguage),
        toLanguage: getLanguageLabel(toLanguage),
      },
    });

    if (error || !data?.translations?.length) {
      return [];
    }

    return subtitles
      .map((subtitle, index) => ({
        ...subtitle,
        text: data.translations[index]?.translation || "",
      }))
      .filter((subtitle) => subtitle.text.trim().length > 0);
  } catch {
    return [];
  }
}

export async function persistSubtitleTrack(
  filmId: string,
  language: string,
  subtitles: SubtitleSegment[],
) {
  if (!subtitles.length) {
    return;
  }

  await supabase.from("subtitles").delete().eq("film_id", filmId).eq("language", language);

  for (let i = 0; i < subtitles.length; i += 100) {
    const batch = subtitles.slice(i, i + 100).map((subtitle, index) => ({
      film_id: filmId,
      start_time: subtitle.start,
      end_time: subtitle.end,
      text: subtitle.text,
      sort_order: i + index,
      language,
    }));

    const { error } = await supabase.from("subtitles").insert(batch);
    if (error) {
      throw error;
    }
  }
}

export async function ensureSubtitleTracks({
  filmId,
  videoId,
  primaryLanguage,
  secondaryLanguage,
}: {
  filmId: string;
  videoId: string;
  primaryLanguage: string;
  secondaryLanguage: string;
}) {
  let { primary, secondary } = await loadStoredSubtitleTracks(
    filmId,
    primaryLanguage,
    secondaryLanguage,
  );

  if (!primary.length) {
    primary = await fetchSubtitleTrackFromBackend(videoId, primaryLanguage);
    if (primary.length) {
      await persistSubtitleTrack(filmId, primaryLanguage, primary);
    }
  }

  if (secondaryLanguage !== primaryLanguage && !secondary.length) {
    secondary = await fetchSubtitleTrackFromBackend(videoId, secondaryLanguage);

    if (!secondary.length && primary.length) {
      secondary = await translateSubtitleTrack(primary, primaryLanguage, secondaryLanguage);
    }

    if (secondary.length) {
      await persistSubtitleTrack(filmId, secondaryLanguage, secondary);
    }
  }

  return {
    primary,
    secondary: secondaryLanguage === primaryLanguage ? primary : secondary,
  };
}