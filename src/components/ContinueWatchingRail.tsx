// Continue Watching rail — pulled from watch_history + video_comprehension.
// Each card surfaces the user's most recent comprehension and improvement.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { coverageBadge } from "@/lib/coverage";
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
  const { learningLanguage } = useLanguage();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) { setRows([]); return; }
    let alive = true;
    const lang = (learningLanguage || "").toLowerCase();
    (async () => {
      // Built from watch history (any started, unfinished video) in the
      // active language only — not from scored results, which only exist
      // after a fuller watch.
      const { data: wh } = await supabase
        .from("watch_history")
        .select("film_id, title, thumbnail_url, language, completion_pct, watched_at")
        .eq("user_id", user.id)
        .eq("language", lang)
        .not("film_id", "is", null)
        .lt("completion_pct", 90)
        .order("watched_at", { ascending: false })
        .limit(12);
      const list = (wh as any[]) || [];
      if (list.length === 0) { if (alive) setRows([]); return; }
      const ids = list.map((r) => r.film_id);
      const { data: vc } = await supabase
        .from("video_comprehension" as any)
        .select("content_id, latest_score, first_score, watch_count")
        .eq("user_id", user.id)
        .eq("content_type", "film")
        .in("content_id", ids);
      const vmap = new Map<string, any>();
      for (const v of (vc as any[]) || []) vmap.set(v.content_id, v);
      const seen = new Set<string>();
      const out: Row[] = [];
      for (const r of list) {
        if (seen.has(r.film_id)) continue;
        seen.add(r.film_id);
        const v = vmap.get(r.film_id);
        out.push({
          film_id: r.film_id,
          title: r.title || "Video",
          thumbnail_url: r.thumbnail_url,
          language: r.language,
          last_watched_at: r.watched_at,
          watch_count: Number(v?.watch_count || 1),
          first_score: v ? Number(v.first_score) : NaN,
          latest_score: v ? Number(v.latest_score) : NaN,
        });
      }
      if (alive) setRows(out);
    })();
    return () => { alive = false; };
  }, [user, learningLanguage]);

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
          const scored = Number.isFinite(r.latest_score);
          const delta = scored ? Math.round(r.latest_score - r.first_score) : 0;
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
                {scored && (
                  <div className="absolute bottom-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
                    {coverageBadge(r.latest_score)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
              </div>
              <p className="text-sm text-foreground truncate font-medium">{r.title}</p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                <span>{getLanguageFlag(r.language ?? "fr")} {getLanguageLabel(r.language ?? "fr")}</span>
                {scored && <span className={cn(
                  "font-semibold",
                  up ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-muted-foreground"
                )}>
                  {up ? "+" : ""}{delta}%
                </span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
