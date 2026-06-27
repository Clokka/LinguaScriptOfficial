// Netflix-style catalog rails on the Home tab, pulled directly from the
// Admin-managed `catalog_rows` / `catalog_row_films` tables. Replaces the
// old "Your Lessons" grid as the main browsing surface.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ContentCard, type ContentCardFilm } from "@/components/ContentCard";
import { estimateFilms, type FilmEstimate } from "@/lib/contentEstimate";

interface Row {
  id: string;
  title: string;
  films: ContentCardFilm[];
}

export function HomeCatalogRows() {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [estimates, setEstimates] = useState<Map<string, FilmEstimate>>(new Map());

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: rowsData } = await supabase
        .from("catalog_rows")
        .select("*")
        .or(`language.is.null,language.eq.${learningLanguage}`)
        .order("sort_order");
      if (!alive || !rowsData) return;

      const withFilms = await Promise.all(
        rowsData.map(async (r: any) => {
          const { data: pins } = await supabase
            .from("catalog_row_films")
            .select("sort_order, films(*)")
            .eq("row_id", r.id)
            .order("sort_order");
          const films = (pins || [])
            .map((p: any) => p.films)
            .filter((f: any) => f && f.is_public && (!f.language || f.language === learningLanguage));
          return { id: r.id, title: r.title, films } as Row;
        }),
      );
      const filtered = withFilms.filter((r) => r.films.length > 0);
      if (!alive) return;
      setRows(filtered);

      // Batch-estimate all visible films in one shot.
      const ids = Array.from(new Set(filtered.flatMap((r) => r.films.map((f) => f.id))));
      if (ids.length > 0) {
        const map = await estimateFilms(user?.id ?? null, ids, learningLanguage);
        if (alive) setEstimates(map);
      }
    })();
    return () => { alive = false; };
  }, [learningLanguage, user]);

  if (!rows || rows.length === 0) return null;

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
