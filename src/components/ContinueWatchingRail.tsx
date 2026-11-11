// "Rewatch to 100% green" rail — pulled from watch_history + video_comprehension.
// The LinguaScript method is rewatching a video until every word is green, so
// every watched video that isn't fully green yet stays here (finished ones
// too), most recent first. Each card shows how green it is and the gain since
// the first watch. The last list is kept on the device so the rail shows
// instantly, then refreshes quietly.
// The bin on each card opens a box to delete that video from the learner's
// history everywhere in LinguaScript (forget_video RPC). Saved words stay.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, ChevronRight, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";

interface Row {
  film_id: string;
  video_id: string | null;
  title: string;
  thumbnail_url: string | null;
  language: string | null;
  last_watched_at: string;
  watch_count: number;
  first_score: number;
  latest_score: number;
}

const MAX_ROWS = 12;
const cacheKey = (userId: string, lang: string) => `ls.rewatch:${userId}:${lang}`;

function readCache(key: string): Row[] | null {
  try {
    const raw = localStorage.getItem(key);
    // JSON turns NaN into null; restore it so "not scored yet" stays NaN.
    return raw
      ? (JSON.parse(raw) as Row[]).map((r) => ({
          ...r,
          first_score: r.first_score ?? NaN,
          latest_score: r.latest_score ?? NaN,
        }))
      : null;
  } catch {
    return null;
  }
}

export function ContinueWatchingRail() {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [toForget, setToForget] = useState<Row | null>(null);
  const [forgetting, setForgetting] = useState(false);
  const { toast } = useToast();

  const forget = async (r: Row) => {
    if (!user) return;
    setForgetting(true);
    const { error } = await supabase.rpc("forget_video", { _film_id: r.film_id, _video_id: r.video_id ?? null });
    setForgetting(false);
    setToForget(null);
    if (error) {
      toast({ title: "Couldn't delete it", description: "Please try again.", variant: "destructive" });
      return;
    }
    const next = (rows || []).filter((x) => x.film_id !== r.film_id);
    setRows(next);
    try {
      localStorage.setItem(cacheKey(user.id, (learningLanguage || "").toLowerCase()), JSON.stringify(next));
    } catch { /* ignore */ }
    toast({ title: "Deleted from your history", description: `"${r.title}" is gone from LinguaScript. Your saved words are still in your decks.` });
  };

  useEffect(() => {
    if (!user) { setRows([]); return; }
    let alive = true;
    const lang = (learningLanguage || "").toLowerCase();
    const key = cacheKey(user.id, lang);
    setRows(readCache(key));
    (async () => {
      // Built from watch history in the active language — started or
      // finished — not from scored results, which only exist after a fuller
      // watch. Fetch extra so fully green videos can be dropped.
      const { data: wh } = await supabase
        .from("watch_history")
        .select("film_id, video_id, title, thumbnail_url, language, completion_pct, watched_at")
        .eq("user_id", user.id)
        .eq("language", lang)
        .not("film_id", "is", null)
        .order("watched_at", { ascending: false })
        .limit(60);
      const list = (wh as any[]) || [];
      if (list.length === 0) {
        if (alive) setRows([]);
        try { localStorage.removeItem(key); } catch { /* ignore */ }
        return;
      }
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
        // Fully green: nothing left to learn from this one.
        if (v && Number(v.latest_score) >= 100) continue;
        out.push({
          film_id: r.film_id,
          video_id: r.video_id ?? null,
          title: r.title || "Video",
          thumbnail_url: r.thumbnail_url,
          language: r.language,
          last_watched_at: r.watched_at,
          watch_count: Number(v?.watch_count || 1),
          first_score: v ? Number(v.first_score) : NaN,
          latest_score: v ? Number(v.latest_score) : NaN,
        });
      }
      const top = out.slice(0, MAX_ROWS);
      if (alive) setRows(top);
      try { localStorage.setItem(key, JSON.stringify(top)); } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [user, learningLanguage]);

  if (!user || !rows || rows.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Rewatch to 100% green</h2>
          <p className="text-xs text-muted-foreground">Each rewatch turns more words green.</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {rows.map((r) => {
          const scored = Number.isFinite(r.latest_score);
          const delta = scored ? Math.round(r.latest_score - r.first_score) : 0;
          const up = delta > 0;
          return (
            <div key={r.film_id} className="relative shrink-0 w-[220px]">
            <button
              onClick={() => navigate(`/watch/${r.film_id}`)}
              className="group w-full text-left"
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
                    {Math.round(r.latest_score)}% green
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
            <button
              type="button"
              aria-label={`Delete ${r.title} from history`}
              title="Delete from history"
              onClick={() => setToForget(r)}
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            </div>
          );
        })}
      </div>
      <AlertDialog open={!!toForget} onOpenChange={(o) => { if (!o && !forgetting) setToForget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video from your history?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toForget?.title}" will be removed from LinguaScript: where you stopped, your rewatch
              count and how green it was. Your saved words stay in your decks. If a teacher set this
              video as a task, they will see it as not started. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={forgetting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={forgetting}
              onClick={(e) => { e.preventDefault(); if (toForget) void forget(toForget); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {forgetting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
