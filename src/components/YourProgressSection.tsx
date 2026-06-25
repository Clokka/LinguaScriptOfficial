// "Your Progress" — per-video comprehension history, sorted by largest
// improvement. Drives the core LinguaScript message: "I understand more of
// this video than I did before."
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Play, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listYourProgress, type ProgressRow } from "@/lib/videoComprehension";
import { cn } from "@/lib/utils";

export const YourProgressSection = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProgressRow[] | null>(null);

  useEffect(() => {
    if (!user) { setRows([]); return; }
    let alive = true;
    listYourProgress(user.id).then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [user]);

  if (!user) return null;
  if (rows === null) {
    return (
      <div className={cn("glass-panel p-6 rounded-2xl flex items-center justify-center", className)}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Your Progress
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How much more you understand each video than you did before.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.slice(0, 9).map((row) => {
          const delta = Math.round(row.delta);
          const up = delta > 0;
          return (
            <button
              key={row.id}
              onClick={() => row.content_type === "film" && navigate(`/watch/${row.content_id}`)}
              className="text-left glass-panel rounded-xl p-3 hover:border-primary/40 transition-colors group flex gap-3"
            >
              <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-secondary shrink-0">
                {row.thumbnail_url ? (
                  <img src={row.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {row.title || "Untitled video"}
                </p>
                <div className="flex items-baseline gap-1 mt-1 tabular-nums">
                  <span className="text-xs text-muted-foreground">
                    {Math.round(row.first_score)}%
                  </span>
                  <span className="text-muted-foreground/60 text-xs">→</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    {Math.round(row.latest_score)}%
                  </span>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1 mt-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                    up
                      ? "bg-emerald-500/15 text-emerald-300"
                      : delta < 0
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {up ? "+" : ""}
                  {delta}%
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
