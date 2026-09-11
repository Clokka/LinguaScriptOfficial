import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageLabel } from "@/lib/languages";
import { INTERESTS, interestById } from "@/lib/interests";
import { rankByComprehension } from "@/lib/videoRecommendation";
import type { LearningZone } from "@/lib/understanding";

interface YTItem {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail?: string;
  publishedAt?: string;
  durationSeconds?: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
  /** Set once a candidate has been scored against the learner's real deck. */
  comprehensionPct?: number;
  zone?: LearningZone;
}

const DIFF_BADGE: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  intermediate: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  advanced: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const ZONE_BADGE: Record<LearningZone, string> = {
  "too-easy": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  ideal: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  stretch: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "too-hard": "bg-rose-500/15 text-rose-300 border-rose-500/30",
};
const ZONE_LABEL: Record<LearningZone, string> = {
  "too-easy": "Already know this",
  ideal: "Ideal for you",
  stretch: "A stretch",
  "too-hard": "Very hard",
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
  nativeLanguage,
  onWatch,
  importing,
}: {
  interests: string[];
  /**
   * Learner's own language — rankByComprehension needs it to fetch a
   * fallback caption track when the learning-language one is unavailable.
   * LanguageContext doesn't carry this; it's page-local state elsewhere.
   */
  nativeLanguage: string;
  onWatch: (ytId: string, title?: string, thumb?: string) => Promise<void>;
  importing: boolean;
}) => {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();

  const [recommended, setRecommended] = useState<YTItem[]>([]);
  const [trending, setTrending] = useState<YTItem[]>([]);
  const [beginner, setBeginner] = useState<YTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(true);
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
      setScoring(true);

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
      // Trending/beginner stay on the fast metadata-only path — they're
      // generic categories, not matched to this learner's own vocabulary.
      setTrending(tr.slice(0, 12));
      setBeginner(
        bg.filter((x) => x.difficulty === "beginner").slice(0, 12).length > 0
          ? bg.filter((x) => x.difficulty === "beginner").slice(0, 12)
          : bg.slice(0, 12),
      );
      setLoading(false);

      // Recommended + per-interest rails are the actual personalized surface:
      // score each candidate's real captions against the learner's saved-word
      // deck and keep only the ones near the 95–98%-known "ideal" band,
      // ranked by closeness to it. This is the whole point — a title-keyword
      // guess can't know what THIS learner already knows.
      const nativeLang = nativeLanguage || "en";
      const [rankedRec, ...rankedInterests] = await Promise.all([
        rankByComprehension(rec, learningLanguage, nativeLang, user?.id ?? null),
        ...interestRailDefs.map((_, idx) =>
          rankByComprehension(perInterest[idx] || [], learningLanguage, nativeLang, user?.id ?? null),
        ),
      ]);
      if (cancelled) return;
      setRecommended(
        rankedRec.slice(0, 12).map((r) => ({ ...r.item, comprehensionPct: r.comprehensionPct, zone: r.zone })),
      );
      const perMap: Record<string, YTItem[]> = {};
      interestRailDefs.forEach((i, idx) => {
        perMap[i.id] = rankedInterests[idx]
          .slice(0, 12)
          .map((r) => ({ ...r.item, comprehensionPct: r.comprehensionPct, zone: r.zone }));
      });
      setInterestRails(perMap);
      setScoring(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.id, learningLanguage, nativeLanguage, langLabel, interestRailDefs, selectedInterests]);

  const pick = async (it: YTItem) => {
    if (importing || pendingId) return;
    setPendingId(it.videoId);
    try { await onWatch(it.videoId, it.title, it.thumbnail); }
    finally { setPendingId(null); }
  };

  return (
    <div className="space-y-10">
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Building recommendations in {langLabel}…
        </div>
      )}

      {!loading && scoring && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Matching videos to what you already know…
        </div>
      )}

      {!scoring && recommended.length > 0 && (
        <Rail title={`🎯 Recommended for you in ${langLabel}`}>
          {recommended.map((it) => (
            <YTCard key={it.videoId} it={it} onPick={pick} loading={pendingId === it.videoId} />
          ))}
        </Rail>
      )}

      {!scoring && interestRailDefs.map((i) => {
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
      {it.zone ? (
        <span className={`absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded border ${ZONE_BADGE[it.zone]}`}>
          {typeof it.comprehensionPct === "number" ? `${it.comprehensionPct}% · ` : ""}{ZONE_LABEL[it.zone]}
        </span>
      ) : it.difficulty ? (
        <span className={`absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded border ${DIFF_BADGE[it.difficulty]}`}>
          {it.difficulty}
        </span>
      ) : null}
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
