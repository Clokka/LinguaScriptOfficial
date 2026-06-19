import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Play, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageLabel } from "@/lib/languages";
import { INTERESTS, interestById } from "@/lib/interests";

interface YTItem {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail?: string;
  publishedAt?: string;
  durationSeconds?: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
}

interface ContinueItem {
  video_id: string;
  title: string | null;
  thumbnail_url: string | null;
  film_id: string | null;
  position_seconds: number;
  duration_seconds: number;
  completion_pct: number;
}

const DIFF_BADGE: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  intermediate: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  advanced: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function fmtDur(s?: number) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Session-scoped cache so flipping between tabs doesn't burn YouTube quota. */
async function cachedSearch(key: string, q: string, lang: string): Promise<YTItem[]> {
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return JSON.parse(hit) as YTItem[];
  } catch {}
  const { data, error } = await supabase.functions.invoke("youtube-search", {
    body: { q, lang },
  });
  if (error) return [];
  const items: YTItem[] = (data as any)?.items || [];
  try { sessionStorage.setItem(key, JSON.stringify(items)); } catch {}
  return items;
}

export const PersonalizedRails = ({
  interests,
  onWatch,
  importing,
}: {
  interests: string[];
  onWatch: (ytId: string, title?: string, thumb?: string) => Promise<void>;
  importing: boolean;
}) => {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const navigate = useNavigate();

  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [recommended, setRecommended] = useState<YTItem[]>([]);
  const [trending, setTrending] = useState<YTItem[]>([]);
  const [beginner, setBeginner] = useState<YTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const langLabel = useMemo(() => getLanguageLabel(learningLanguage), [learningLanguage]);

  // Resolve selected interests into ordered Interest objects (deterministic).
  const selectedInterests = useMemo(() => {
    const ids = (interests && interests.length > 0)
      ? interests
      : INTERESTS.slice(0, 3).map((i) => i.id);
    return ids.map((id) => interestById(id)).filter(Boolean) as typeof INTERESTS;
  }, [interests]);

  // Per-interest rails: cap to 3 so we don't burn YouTube quota.
  const interestRailDefs = useMemo(() => selectedInterests.slice(0, 3), [selectedInterests]);

  const [interestRails, setInterestRails] = useState<Record<string, YTItem[]>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      // Continue Watching from watch_history
      if (user) {
        const { data } = await supabase
          .from("watch_history")
          .select("video_id,title,thumbnail_url,film_id,position_seconds,duration_seconds,completion_pct")
          .eq("user_id", user.id)
          .lt("completion_pct", 95)
          .order("watched_at", { ascending: false })
          .limit(10);
        if (!cancelled) setContinueItems((data as any) || []);
      }

      // Top-level rec rail uses a broad blend of selected interests so it feels
      // like a personalised homepage rather than a single-topic feed.
      const blendQuery = selectedInterests.slice(0, 3).map((i) => i.query).join(" OR ");
      const blendKey = selectedInterests.slice(0, 3).map((i) => i.id).join("+") || "default";

      const [rec, tr, bg, ...perInterest] = await Promise.all([
        cachedSearch(
          `rails:rec:${learningLanguage}:${blendKey}`,
          `${langLabel} ${blendQuery}`,
          learningLanguage,
        ),
        cachedSearch(
          `rails:trending:${learningLanguage}`,
          `${langLabel} trending 2026`,
          learningLanguage,
        ),
        cachedSearch(
          `rails:beginner:${learningLanguage}`,
          `${langLabel} for beginners slow easy`,
          learningLanguage,
        ),
        ...interestRailDefs.map((i) =>
          cachedSearch(
            `rails:interest:${learningLanguage}:${i.id}`,
            `${langLabel} ${i.query}`,
            learningLanguage,
          ),
        ),
      ]);
      if (cancelled) return;
      setRecommended(rec.slice(0, 12));
      setTrending(tr.slice(0, 12));
      setBeginner(
        bg.filter((x) => x.difficulty === "beginner").slice(0, 12).length > 0
          ? bg.filter((x) => x.difficulty === "beginner").slice(0, 12)
          : bg.slice(0, 12),
      );
      const perMap: Record<string, YTItem[]> = {};
      interestRailDefs.forEach((i, idx) => { perMap[i.id] = (perInterest[idx] || []).slice(0, 12); });
      setInterestRails(perMap);
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [user, learningLanguage, langLabel, interestRailDefs, selectedInterests]);

  const pick = async (it: YTItem) => {
    if (importing || pendingId) return;
    setPendingId(it.videoId);
    try { await onWatch(it.videoId, it.title, it.thumbnail); }
    finally { setPendingId(null); }
  };

  const openContinue = async (c: ContinueItem) => {
    if (c.film_id) { navigate(`/watch/${c.film_id}`); return; }
    // Fallback: resolve film by URL
    const url = `https://www.youtube.com/watch?v=${c.video_id}`;
    const { data } = await supabase.from("films").select("id").eq("url", url).limit(1).maybeSingle();
    if (data?.id) navigate(`/watch/${data.id}`);
  };

  return (
    <div className="space-y-10">
      {continueItems.length > 0 && (
        <Rail title="Continue Watching">
          {continueItems.map((c) => (
            <button
              key={c.video_id}
              onClick={() => openContinue(c)}
              className="group w-56 shrink-0 text-left"
            >
              <div className="relative aspect-video rounded-xl overflow-hidden bg-secondary border border-border group-hover:border-primary/50 transition">
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt={c.title || ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-muted-foreground" /></div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, c.completion_pct)}%` }} />
                </div>
                {c.duration_seconds > 0 && (
                  <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                    {fmtDur(c.duration_seconds - c.position_seconds)} left
                  </span>
                )}
              </div>
              <p className="text-sm mt-2 line-clamp-2 text-foreground">{c.title || "Untitled"}</p>
            </button>
          ))}
        </Rail>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Building recommendations in {langLabel}…
        </div>
      )}

      {recommended.length > 0 && (
        <Rail title={`🎯 Recommended for you in ${langLabel}`}>
          {recommended.map((it) => (
            <YTCard key={it.videoId} it={it} onPick={pick} loading={pendingId === it.videoId} />
          ))}
        </Rail>
      )}

      {interestRailDefs.map((i) => {
        const items = interestRails[i.id] || [];
        if (items.length === 0) return null;
        return (
          <Rail key={i.id} title={`${i.emoji} Because you like ${i.label}`}>
            {items.map((it) => (
              <YTCard key={it.videoId} it={it} onPick={pick} loading={pendingId === it.videoId} />
            ))}
          </Rail>
        );
      })}

      {trending.length > 0 && (
        <Rail title={`Trending in ${langLabel}`}>
          {trending.map((it) => (
            <YTCard key={it.videoId} it={it} onPick={pick} loading={pendingId === it.videoId} />
          ))}
        </Rail>
      )}

      {beginner.length > 0 && (
        <Rail title="Beginner friendly">
          {beginner.map((it) => (
            <YTCard key={it.videoId} it={it} onPick={pick} loading={pendingId === it.videoId} />
          ))}
        </Rail>
      )}
    </div>
  );
};

const Rail = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
      {children}
    </div>
  </section>
);

const YTCard = ({
  it, onPick, loading,
}: {
  it: YTItem;
  onPick: (it: YTItem) => void;
  loading: boolean;
}) => (
  <button
    onClick={() => onPick(it)}
    disabled={loading}
    className="group w-56 shrink-0 text-left snap-start disabled:opacity-60"
  >
    <div className="relative aspect-video rounded-xl overflow-hidden bg-secondary border border-border group-hover:border-primary/50 transition">
      {it.thumbnail ? (
        <img src={it.thumbnail} alt={it.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-muted-foreground" /></div>
      )}
      {it.durationSeconds ? (
        <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />{fmtDur(it.durationSeconds)}
        </span>
      ) : null}
      {it.difficulty && (
        <span className={`absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded border ${DIFF_BADGE[it.difficulty]}`}>
          {it.difficulty}
        </span>
      )}
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-black/50">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        </div>
      )}
    </div>
    <p className="text-sm mt-2 line-clamp-2 text-foreground">{it.title}</p>
    {it.channel && <p className="text-xs text-muted-foreground line-clamp-1">{it.channel}</p>}
  </button>
);
