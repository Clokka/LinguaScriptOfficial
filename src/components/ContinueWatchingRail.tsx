// Continue Watching rail — pulled from watch_history + video_comprehension.
// Each card surfaces the user's most recent comprehension and improvement.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";

interface Row {
  film_id: string;
  title: string;
  thumbnail_url: string | null;
  language: string | null;
  last_watched_at: string;
  watch_count: number;
  first_score: number;
  latest_score: number;
}

export function ContinueWatchingRail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) { setRows([]); return; }
    let alive = true;
    (async () => {
      const { data: vc } = await supabase
        .from("video_comprehension" as any)
        .select("content_id, content_type, latest_score, first_score, watch_count, last_watched_at")
        .eq("user_id", user.id)
        .eq("content_type", "film")
        .lt("latest_score", 95)
        .order("last_watched_at", { ascending: false })
        .limit(12);
      const list = (vc as any[]) || [];
      if (list.length === 0) { if (alive) setRows([]); return; }
      const ids = list.map((r) => r.content_id);
      const { data: films } = await supabase
        .from("films")
        .select("id, title, thumbnail_url, language")
        .in("id", ids);
      const fmap = new Map<string, any>();
      for (const f of (films as any[]) || []) fmap.set(f.id, f);
      const out: Row[] = list
        .map((r) => {
          const f = fmap.get(r.content_id);
          if (!f) return null;
          return {
            film_id: r.content_id,
            title: f.title,
            thumbnail_url: f.thumbnail_url,
            language: f.language,
            last_watched_at: r.last_watched_at,
            watch_count: Number(r.watch_count || 1),
            first_score: Number(r.first_score),
            latest_score: Number(r.latest_score),
          } as Row;
        })
        .filter(Boolean) as Row[];
      if (alive) setRows(out);
    })();
    return () => { alive = false; };
  }, [user]);

  if (!user || !rows || rows.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Continue Watching</h2>
          <p className="text-xs text-muted-foreground">Your last sessions — each rewatch grows comprehension.</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {rows.map((r) => {
          const delta = Math.round(r.latest_score - r.first_score);
          const up = delta > 0;
          return (
            <button
              key={r.film_id}
              onClick={() => navigate(`/watch/${r.film_id}`)}
              className="group shrink-0 w-[220px] text-left"
            >
              <div className="relative rounded-xl overflow-hidden aspect-video bg-secondary mb-2 border border-border group-hover:border-primary/50 transition-all">
                {r.thumbnail_url ? (
                  <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-muted-foreground" /></div>
                )}
                <div className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
                  Watch #{r.watch_count}
                </div>
                <div className="absolute bottom-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/90 text-white">
                  {Math.round(r.latest_score)}%
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
              </div>
              <p className="text-sm text-foreground truncate font-medium">{r.title}</p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                <span>{getLanguageFlag(r.language ?? "fr")} {getLanguageLabel(r.language ?? "fr")}</span>
                <span className={cn(
                  "font-semibold",
                  up ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-muted-foreground"
                )}>
                  {up ? "+" : ""}{delta}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
