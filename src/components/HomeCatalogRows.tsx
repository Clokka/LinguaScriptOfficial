// Netflix-style catalog rails on the Home tab, pulled directly from the
// Admin-managed `catalog_rows` / `catalog_row_films` tables. Replaces the
// old "Your Lessons" grid as the main browsing surface.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ContentCard, type ContentCardFilm } from "@/components/ContentCard";
import { estimateFilms, type FilmEstimate } from "@/lib/contentEstimate";
import { passesContentLengthPolicy } from "@/lib/contentLengthPolicy";

interface Row {
  id: string;
  title: string;
  films: ContentCardFilm[];
}

// Rows from the last visit, shown instantly while the fresh copy loads, so
// the free library is never a blank gap on a slow phone connection.
const cacheKey = (lang: string) => `home-catalog-rows:v1:${lang}`;
function readCache(lang: string): Row[] | null {
  try {
    const hit = localStorage.getItem(cacheKey(lang));
    return hit ? (JSON.parse(hit) as Row[]) : null;
  } catch { return null; }
}
function writeCache(lang: string, rows: Row[]) {
  try { localStorage.setItem(cacheKey(lang), JSON.stringify(rows)); } catch {}
}

const bySortOrder = (a: { sort_order?: number | null }, b: { sort_order?: number | null }) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0);

export function HomeCatalogRows() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { learningLanguage } = useLanguage();
  const [rows, setRows] = useState<Row[] | null>(() => readCache(learningLanguage));
  const [estimates, setEstimates] = useState<Map<string, FilmEstimate>>(new Map());

  useEffect(() => {
    let alive = true;
    setRows(readCache(learningLanguage));
    (async () => {
      // One request for every row and its films — was one request per row,
      // all of which had to finish before anything showed.
      const { data: rowsData, error } = await supabase
        .from("catalog_rows")
        .select("id, title, sort_order, catalog_row_films(sort_order, films(id, title, thumbnail_url, language, duration_seconds, is_public, category, tags))")
        .or(`language.is.null,language.eq.${learningLanguage}`)
        .order("sort_order");
      if (!alive) return;
      if (error || !rowsData) {
        setRows((r) => r ?? []);
        return;
      }

      const filtered = (rowsData as any[])
        .sort(bySortOrder)
        .map((r) => {
          const films = [...(r.catalog_row_films || [])]
            .sort(bySortOrder)
            .map((p: any) => p.films)
            .filter((f: any) => f && f.is_public && (!f.language || f.language === learningLanguage) && passesContentLengthPolicy(f))
            .map((f: any) => ({
              id: f.id,
              title: f.title,
              thumbnail_url: f.thumbnail_url,
              language: f.language,
              duration_seconds: f.duration_seconds,
            }));
          return { id: r.id, title: r.title, films } as Row;
        })
        .filter((r) => r.films.length > 0);
      setRows(filtered);
      writeCache(learningLanguage, filtered);

      // Batch-estimate all visible films in one shot (badges fill in after).
      const ids = Array.from(new Set(filtered.flatMap((r) => r.films.map((f) => f.id))));
      if (ids.length > 0) {
        const map = await estimateFilms(userId, ids, learningLanguage);
        if (alive) setEstimates(map);
      }
    })();
    return () => { alive = false; };
  }, [learningLanguage, userId]);

  if (rows === null) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-5 w-40 rounded bg-secondary animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-[180px] shrink-0 aspect-video rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <div className="space-y-8">
      {rows.map((row) => (
        <section key={row.id}>
          <h2 className="text-lg font-semibold text-foreground mb-3">{row.title}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {row.films.map((f) => (
              <ContentCard key={f.id} film={f} estimate={estimates.get(f.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
