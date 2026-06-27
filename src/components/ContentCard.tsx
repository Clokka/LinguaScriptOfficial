// Shared content card used by Home catalog rows.
// Shows thumbnail, title, and the "Estimated Understanding XX%" badge that
// replaces the old Beginner/Intermediate/Advanced difficulty labels.
import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { bandClasses, bandLabel, type FilmEstimate } from "@/lib/contentEstimate";

export interface ContentCardFilm {
  id: string;
  title: string;
  thumbnail_url: string | null;
  language: string | null;
  duration_seconds?: number | null;
}

function formatDuration(s?: number | null): string {
  if (!s || s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function ContentCard({
  film,
  estimate,
  width = 220,
}: {
  film: ContentCardFilm;
  estimate?: FilmEstimate;
  width?: number;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/watch/${film.id}`)}
      className="group shrink-0 text-left"
      style={{ width }}
    >
      <div className="relative rounded-xl overflow-hidden aspect-video bg-secondary mb-2 border border-border group-hover:border-primary/50 transition-all">
        {film.thumbnail_url ? (
          <img
            src={film.thumbnail_url}
            alt={film.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        {film.duration_seconds ? (
          <div className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white tabular-nums">
            {formatDuration(film.duration_seconds)}
          </div>
        ) : null}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
          </div>
        </div>
      </div>
      <p className="text-sm text-foreground truncate font-medium">{film.title}</p>
      {estimate && estimate.pct !== null && estimate.band ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {estimate.pct}%
          </span>
          <span
            className={cn(
              "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
              bandClasses(estimate.band),
            )}
          >
            {bandLabel(estimate.band)}
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground mt-0.5">Estimate available after watching</p>
      )}
    </button>
  );
}
