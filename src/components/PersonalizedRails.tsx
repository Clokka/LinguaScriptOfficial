import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageLabel } from "@/lib/languages";
import { INTERESTS, interestById, interestQueries, type Interest } from "@/lib/interests";
import { customTopicQueries, customTopicRailId, fetchCustomFeedTopics, type CustomFeedTopic } from "@/lib/customFeedTopics";
import { recordFeedEvent } from "@/lib/feedSignals";
import { TIER_CLASS, TIER_LABEL, coverageBadge, coverageTier, isRecommended } from "@/lib/coverage";
import { rankByComprehension } from "@/lib/videoRecommendation";
import { cefrSearchModifier } from "@/lib/cefrQueryModifiers";
import { getLanguageProfile } from "@/lib/languageProfiles";
import type { LearningZone } from "@/lib/understanding";
import { popularityScore } from "@/lib/videoPopularity";
import { Button } from "@/components/ui/button";

interface YTItem {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail?: string;
  publishedAt?: string;
  durationSeconds?: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
  viewCount?: number;
  likeCount?: number;
  /** Set once a candidate has been scored against the learner's real deck. */
  comprehensionPct?: number;
  zone?: LearningZone;
}

const DIFF_BADGE: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  intermediate: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  advanced: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const ZONE_BADGE = TIER_CLASS;

function fmtDur(s?: number) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Session-scoped cache on top of the edge function's own 24h shared cache.
 * `failed` is surfaced so the UI can say "couldn't reach YouTube" instead of
 * rendering a silent empty rail that looks like a broken page.
 */
async function cachedSearch(
  key: string,
  q: string,
  lang: string,
): Promise<{ items: YTItem[]; failed: boolean }> {
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return { items: JSON.parse(hit) as YTItem[], failed: false };
  } catch {}
  const { data, error } = await supabase.functions.invoke("youtube-search", {
    body: { q, lang },
  });
  if (error || (data as any)?.error) return { items: [], failed: true };
  const items: YTItem[] = (data as any)?.items || [];
  try { sessionStorage.setItem(key, JSON.stringify(items)); } catch {}
  return { items, failed: false };
}

/**
 * The last finished feed, kept on the device (like YouTube or Spotify's home):
 * shown the instant the page opens, then quietly replaced once fresh results
 * have been fetched and scored.
 */
interface FeedSnapshot {
  interestRails: Record<string, YTItem[]>;
  recommended: YTItem[];
  trending: YTItem[];
  beginner: YTItem[];
}
const feedCacheKey = (userId: string | undefined, lang: string) => `ls.feed:${userId || "guest"}:${lang}`;
function readFeed(key: string): FeedSnapshot | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as FeedSnapshot) : null;
  } catch {
    return null;
  }
}
function writeFeed(key: string, feed: FeedSnapshot) {
  try { localStorage.setItem(key, JSON.stringify(feed)); } catch { /* storage full or blocked */ }
}

function dedupe(items: YTItem[]): YTItem[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.videoId) ? false : (seen.add(i.videoId), true)));
}

/** Snackable first: short clips up, ideal-understanding up, very hard down. */
function feedScore(it: YTItem): number { return popularityScore(it); }
function sortFeed(items: YTItem[]): YTItem[] {
  const bucket = (it: YTItem) => it.comprehensionPct === undefined ? 2 : coverageTier(it.comprehensionPct) === "ideal" ? 0 : isRecommended(it.comprehensionPct) ? 1 : 3;
  return items.map((it, i) => ({ it, i })).sort((a, b) => bucket(a.it) - bucket(b.it) || feedScore(b.it) - feedScore(a.it) || a.i - b.i).map((x) => x.it);
}
/** An onboarding interest, or an admin-curated topic carrying its own search phrases. */
type RailDef = Interest & { custom?: CustomFeedTopic };

function roundRobin(lists: YTItem[][]): YTItem[] {
  const out: YTItem[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let r = 0; r < max; r++) for (const l of lists) if (l[r]) out.push(l[r]);
  return dedupe(out);
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
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  // Picks from an interest rail, past sessions included — a much stronger
  // taste signal than the onboarding checkbox itself. Reorders which 3
  // interests get rail slots; never changes the underlying interest list.
  const [interestWeights, setInterestWeights] = useState<Record<string, number>>({});
  // Admin-curated topics for this learner (e.g. pottery, with exact Italian
  // search phrases) — always get the top rail slots.
  const [customTopics, setCustomTopics] = useState<CustomFeedTopic[]>([]);

  const langLabel = useMemo(() => getLanguageLabel(learningLanguage), [learningLanguage]);

  // Resolve selected interests into ordered Interest objects (deterministic).
  const selectedInterests = useMemo(() => {
    const ids = (interests && interests.length > 0)
      ? interests.slice(0, 1)
      : [];
    return ids.map((id) => interestById(id)).filter(Boolean) as typeof INTERESTS;
  }, [interests]);

  // Per-interest rails: cap to 3 so we don't burn YouTube quota. Ordered by
  // actual pick history (falls back to onboarding order for ties/unpicked).
  const interestRailDefs = useMemo<RailDef[]>(() => {
    const custom: RailDef[] = [...customTopics]
      .sort((a, b) => (interestWeights[customTopicRailId(b)] || 0) - (interestWeights[customTopicRailId(a)] || 0))
      .map((t) => ({ id: customTopicRailId(t), label: t.label, emoji: t.emoji, query: t.fallback_query || t.label, custom: t }));
    const onboarding = [...selectedInterests]
      .sort((a, b) => (interestWeights[b.id] || 0) - (interestWeights[a.id] || 0));
    return onboarding.length ? onboarding.slice(0, 1) : custom.slice(0, 1);
  }, [customTopics, selectedInterests, interestWeights]);

  const [interestRails, setInterestRails] = useState<Record<string, YTItem[]>>({});

  // Show the last feed straight away; the load below refreshes it quietly.
  const feedKey = `${feedCacheKey(user?.id, learningLanguage)}:hobby-v3:${selectedInterests.map((i) => i.id).join(",")}:${nativeLanguage}`;
  const shownCachedRef = useRef<string | null>(null);
  useEffect(() => {
    const cached = readFeed(feedKey);
    if (!cached) {
      shownCachedRef.current = null;
      setInterestRails({}); setRecommended([]); setTrending([]); setBeginner([]);
      return;
    }
    shownCachedRef.current = feedKey;
    setInterestRails(cached.interestRails || {});
    setRecommended(cached.recommended || []);
    setTrending(cached.trending || []);
    setBeginner(cached.beginner || []);
    setLoading(false);
    setScoring(false);
  }, [feedKey]);

  // CEFR level + interest pick history: the base-tier signal for search
  // candidate generation, loaded once per user/language rather than per rail.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setCefrLevel(null);
      setInterestWeights({});
      setCustomTopics([]);
      return;
    }
    void (async () => {
      const [profile, signalsRes, custom] = await Promise.all([
        getLanguageProfile(user.id, learningLanguage),
        (supabase as any)
          .from("user_interest_signals")
          .select("interest_id, picks")
          .eq("user_id", user.id)
          .eq("language", learningLanguage.toLowerCase()),
        fetchCustomFeedTopics(user.id),
      ]);
      if (cancelled) return;
      setCustomTopics(custom);
      setCefrLevel(profile?.cefr_level || null);
      const weights: Record<string, number> = {};
      for (const row of (signalsRes?.data as any[]) || []) weights[row.interest_id] = row.picks;
      setInterestWeights(weights);
    })();
    return () => { cancelled = true; };
  }, [user, learningLanguage]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // With a remembered feed on screen there's no spinner: it stays until
      // the fresh, scored feed replaces it.
      const showingCached = shownCachedRef.current === feedKey;
      if (!showingCached) {
        setLoading(true);
        setScoring(true);
      }
      const lang = learningLanguage;

      // Favourite interest gets 2 search phrases, others 1 — keeps quota sane.
      // Custom topics are hand-written for one learner, so all their phrases
      // run (up to 3), exactly as written: the CEFR modifier is English
      // ("for beginners easy slow") and would drag a phrase like "ceramica al
      // tornio" towards English videos. The phrase is in the cache key so
      // admin edits show up.
      const interestSearches = interestRailDefs.map((i, idx) => {
        const qs = i.custom
          ? customTopicQueries(i.custom, lang, langLabel)
          : interestQueries(i, lang, langLabel).slice(0, 1);
        return Promise.all(
          qs.map((q, qi) =>
            cachedSearch(
              `rails:hobby-v3:${lang}:${i.id}:${q}`,
              q,
              lang,
            ),
          ),
        ).then((rs) => ({
          items: dedupe(rs.flatMap((r) => r.items)),
          failed: rs.every((r) => r.failed),
        }));
      });

      const perInterestR = await Promise.all(interestSearches);
      if (cancelled) return;
      const allFailed = perInterestR.some((r) => r.failed);
      // YouTube unreachable: keep the remembered feed rather than blanking it.
      if (allFailed && showingCached) return;
      setSearchFailed(allFailed);

      // Show everything immediately (short clips first); scores fill in later.
      const perMap: Record<string, YTItem[]> = {};
      interestRailDefs.forEach((i, idx) => {
        perMap[i.id] = sortFeed(perInterestR[idx]?.items || []).slice(0, 10);
      });
      const trendingItems: YTItem[] = [];
      const beginnerItems: YTItem[] = [];
      // Unscored results only replace an empty page; a remembered feed waits
      // for the scored one so badges don't vanish and reappear.
      if (!showingCached) {
        setInterestRails(perMap);
        setRecommended([]);
        setTrending(trendingItems);
        setBeginner(beginnerItems);
        setLoading(false);
      }

      // Background: score captions against the learner's words, then
      // re-sort (never filter) and attach the understanding badge.
      const nativeLang = nativeLanguage || "en";
      const ranked = await Promise.all(
        interestRailDefs.map((i) =>
          rankByComprehension(perMap[i.id] || [], lang, nativeLang, user?.id ?? null).catch(() => []),
        ),
      );
      if (cancelled) return;
      const scored: Record<string, YTItem[]> = {};
      interestRailDefs.forEach((i, idx) => {
        const byId = new Map<string, { comprehensionPct: number; zone: LearningZone }>(
          (ranked[idx] as any[]).map((r) => [r.item.videoId, r] as [string, { comprehensionPct: number; zone: LearningZone }]),
        );
        scored[i.id] = sortFeed(
          (ranked[idx] || []).map((r) => ({ ...r.item, comprehensionPct: r.comprehensionPct, zone: r.zone })),
        );
      });
      const recommendedItems = sortFeed(roundRobin(interestRailDefs.map((i) => scored[i.id] || []))).filter((it) => it.comprehensionPct !== undefined && isRecommended(it.comprehensionPct)).slice(0, 10);
      // Authentic hobby picks stay available without pretending unscored
      // or stretch content is a standard learning recommendation.
      const displayRails = Object.fromEntries(interestRailDefs.map((i) => [i.id, sortFeed((perMap[i.id] || []).map((it) => scored[i.id]?.find((s) => s.videoId === it.videoId) ?? it))]));
      setInterestRails(displayRails);
      setRecommended(recommendedItems);
      setTrending(trendingItems);
      setBeginner(beginnerItems);
      setLoading(false);
      setScoring(false);
      writeFeed(feedKey, { interestRails: displayRails, recommended: recommendedItems, trending: trendingItems, beginner: beginnerItems });
    };
    void load().catch(() => { if (!cancelled) { setSearchFailed(true); setLoading(false); setScoring(false); } });
    return () => { cancelled = true; };
  }, [user?.id, learningLanguage, nativeLanguage, langLabel, interestRailDefs, cefrLevel, feedKey]);

  const pick = async (it: YTItem, sourceInterestId?: string) => {
    if (importing || pendingId) return;
    setPendingId(it.videoId);
    try {
      if (sourceInterestId) {
        try { sessionStorage.setItem(`feed:src:${it.videoId}`, JSON.stringify({ interest: sourceInterestId, lang: learningLanguage })); } catch {}
      }
      await onWatch(it.videoId, it.title, it.thumbnail);
      if (sourceInterestId && user?.id) {
        setInterestWeights((w) => ({ ...w, [sourceInterestId]: (w[sourceInterestId] || 0) + 1 }));
        void recordFeedEvent(sourceInterestId, learningLanguage, "open");
      }
    } finally { setPendingId(null); }
  };

  const [topInterest, ...otherInterests] = interestRailDefs;
  const renderInterestRail = (i: (typeof interestRailDefs)[number], first = false) => {
    const items = interestRails[i.id] || [];
    if (items.length === 0) return null;
    return (
      <Rail
        key={i.id}
        title={first ? `${i.emoji} ${i.label} in ${langLabel}` : i.custom ? `${i.emoji} ${i.label}, picked for you` : `${i.emoji} Because you like ${i.label}`}
        subtitle={undefined}
      >
        {items.map((it) => (
          <YTCard key={it.videoId} it={it} onPick={(x) => pick(x, i.id)} loading={pendingId === it.videoId} />
        ))}
      </Rail>
    );
  };

  return (
    <div className="space-y-10">
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Finding {topInterest ? topInterest.label.toLowerCase() : "videos"} in {langLabel}…
        </div>
      )}

      {!loading && searchFailed && (
        <div className="rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
          Fresh picks from YouTube aren't available right now — today's search
          allowance has run out. Your curated library below still works, and new
          recommendations return automatically.
        </div>
      )}

      {topInterest && renderInterestRail(topInterest, true)}

      {recommended.length > 0 && (
        <Rail
          title={`Recommended for you in ${langLabel}`}
        >
          {recommended.map((it) => (
            <YTCard key={it.videoId} it={it} onPick={pick} loading={pendingId === it.videoId} />
          ))}
        </Rail>
      )}

      {otherInterests.map((i) => renderInterestRail(i))}

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

const Rail = ({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section>
    <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
    {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
    <div className={`flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x ${subtitle ? "" : "mt-3"}`}>
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
  <Button
    variant="ghost"
    onClick={() => onPick(it)}
    disabled={loading}
    className="group h-auto w-56 shrink-0 block p-0 text-left whitespace-normal snap-start disabled:opacity-60 hover:bg-transparent"
  >
    <div className="relative aspect-video rounded-xl overflow-hidden bg-secondary border border-border group-hover:border-primary/50 transition">
      {it.thumbnail ? (
        <img src={it.thumbnail} alt={it.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
          {typeof it.comprehensionPct === "number" ? coverageBadge(it.comprehensionPct) : TIER_LABEL[it.zone]}
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
    {(it.viewCount ?? 0) > 0 && <p className="text-xs text-muted-foreground mt-1">{new Intl.NumberFormat(undefined, { notation: "compact" }).format(it.viewCount ?? 0)} views{it.likeCount !== undefined ? ` · ${(100 * it.likeCount / (it.viewCount ?? 1)).toFixed(1)}% likes / views` : ""}</p>}
  </Button>
);
