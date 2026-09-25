// Admin visibility into the shared YouTube search cache. YouTube only allows
// ~100 searches a day across the whole product, so when the rails go quiet the
// first question is always "is the cache serving, and how fresh is it?".
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CacheRow {
  cache_key: string;
  language: string | null;
  query: string | null;
  items: unknown;
  updated_at: string;
}

function ageLabel(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

export function AdminVideoSearchCache() {
  const [rows, setRows] = useState<CacheRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("youtube_search_cache" as any)
      .select("cache_key, language, query, items, updated_at")
      .order("updated_at", { ascending: false })
      .limit(25);
    setRows(((data as any[]) || []) as CacheRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const freshCount = (rows || []).filter(
    (r) => Date.now() - new Date(r.updated_at).getTime() < 24 * 60 * 60 * 1000,
  ).length;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Video search cache</h2>
          <p className="text-xs text-muted-foreground">
            Shared across all learners for 24 hours. Every entry here is a YouTube
            search we did not have to pay for again.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      <div className="text-sm text-foreground">
        {rows === null ? "Loading…" : `${freshCount} fresh of ${rows.length} recent searches`}
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {(rows || []).map((r) => {
          const count = Array.isArray(r.items) ? r.items.length : 0;
          const fresh = Date.now() - new Date(r.updated_at).getTime() < 24 * 60 * 60 * 1000;
          return (
            <div
              key={r.cache_key}
              className="flex items-center justify-between gap-3 text-xs border-b border-border/50 py-1.5"
            >
              <span className="truncate text-foreground">{r.query || r.cache_key}</span>
              <span className="shrink-0 text-muted-foreground">
                {(r.language || "—").toUpperCase()} · {count} videos ·{" "}
                <span className={fresh ? "text-emerald-400" : "text-amber-400"}>{ageLabel(r.updated_at)}</span>
              </span>
            </div>
          );
        })}
        {rows !== null && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nothing cached yet — the next Discover visit will fill this in.
          </p>
        )}
      </div>
    </section>
  );
}
