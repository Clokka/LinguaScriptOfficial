import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, ChevronRight, RefreshCw } from "lucide-react";
import { PageLoading } from "@/components/PageLoading";
import { Button } from "@/components/ui/button";
import { FlashcardReview } from "@/components/FlashcardReview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScanPageButton } from "@/components/ScanPageButton";
import { getGuestWords } from "@/lib/guestWords";
import { DeckState } from "@/lib/vocab";
import { cn } from "@/lib/utils";
import { useTour } from "@/contexts/TourContext";
import { useXp } from "@/contexts/XpContext";
import { consumeReinforcementPending } from "@/lib/dailyVideo";
import { ActiveLanguageBadge } from "@/components/ActiveLanguageBadge";
import { LevelBadge } from "@/components/LevelBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { loadFrequencyCoverage, headlineBand, type CoverageBand } from "@/lib/frequencyCoverage";

function CommonWordsBadge({ language }: { language: string }) {
  const [bands, setBands] = useState<CoverageBand[]>([]);
  useEffect(() => {
    let alive = true;
    loadFrequencyCoverage(language).then((b) => alive && setBands(b));
    return () => { alive = false; };
  }, [language]);
  const h = headlineBand(bands);
  const pct = h && h.total ? Math.min(100, Math.round((h.known / h.total) * 100)) : 0;
  return (
    <div className="shrink-0 w-16 rounded-xl border border-primary/30 bg-primary/10 px-2 py-2 text-center">
      <p className="text-sm font-bold tabular-nums text-foreground leading-none">
        {h ? h.known : 0}<span className="text-muted-foreground font-medium">/{h ? h.band : 50}</span>
      </p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground leading-none">known</p>
    </div>
  );
}

interface SavedWord {
  id: string;
  word: string;
  translation: string;
  pronunciation: string;
  ipa: string;
  context: string;
  contextTranslation?: string;
  language?: string;
  next_review: string;
  review_count: number;
  state: DeckState;
  times_correct: number;
  is_phrase?: boolean;
  ease_factor?: number;
  interval_days?: number;
  image_url?: string | null;
  lemma?: string | null;
  lemma_translation?: string | null;
  is_inflected?: boolean;
  grammar_note?: string | null;
  pos?: string | null;
  /** When the card last changed colour (red → orange → green). */
  state_changed_at?: string | null;
}

interface StarterDeck {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  language: string;
  card_count: number;
}

type DeckKey = "red" | "orange" | "green";

const DECK_CONFIG: Record<DeckKey, { label: string; subtitle: string; color: string; emoji: string; cta: string }> = {
  red:    { label: "UNKNOWN",  subtitle: "Newly saved words",   color: "#FF3B30", emoji: "🔴", cta: "Review" },
  orange: { label: "LEARNING", subtitle: "Strengthening words", color: "#FF8A00", emoji: "🟠", cta: "Review" },
  green:  { label: "KNOWN",    subtitle: "Acquired words",      color: "#34C759", emoji: "🟢", cta: "Browse" },
};

const Flashcards = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { active: tourActive } = useTour();
  const { award } = useXp();
  const { learningLanguage, setLearningLanguage } = useLanguage();
  const [allCards, setAllCards] = useState<SavedWord[]>([]);
  const [starterDecks, setStarterDecks] = useState<StarterDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<DeckKey | null>(null);
  const [reviewCards, setReviewCards] = useState<SavedWord[]>([]);

  const fetchCards = useCallback(async (showSpinner = true) => {
    // Until we know who this is, keep the spinner: treating a signed-in learner
    // as a guest showed "0 cards · Get the Chrome Extension" on every visit.
    if (authLoading) return;
    setLoadError(null);
    if (!user) {
      const guest = getGuestWords();
      setAllCards(guest as unknown as SavedWord[]);
      setLoading(false);
      return;
    }
    // Show the last copy of this deck instantly, then refresh from the server.
    const cacheKey = `ls.cards.${user.id}.${learningLanguage || "all"}`;
    let hadCache = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setAllCards(JSON.parse(cached)); setLoading(false); hadCache = true; }
    } catch { /* ignore */ }
    if (showSpinner && !hadCache) setLoading(true);

    if (learningLanguage) {
      const key = `ls.focusTopUp.${user.id}.${learningLanguage}`;
      const today = new Date().toDateString();
      if (localStorage.getItem(key) !== today) {
        void (async () => { try {
          const { topUpDailyNew } = await import("@/lib/focusDeck");
          const r = await topUpDailyNew(user.id, learningLanguage);
          if (r) {
            localStorage.setItem(key, today);
            window.dispatchEvent(new Event("ls:words-saved"));
          }
        } catch (e) { console.warn("[focusDeck]", e); } })();
      }
    }
    // Large accounts exceed the 1,000-row window: get the count with the first
    // page, then fetch every other page at the same time.
    const pageSize = 1000;
    const page = (from: number, withCount = false) => {
      let q = supabase
        .from("saved_words")
        .select("id, word, translation, pronunciation, ipa, context, language, next_review, review_count, state, times_correct, is_phrase, ease_factor, interval_days, image_url, lemma, lemma_translation, is_inflected, grammar_note, created_at, state_changed_at, pos", withCount ? { count: "exact" } : undefined)
        .eq("user_id", user.id)
        .order("next_review", { ascending: true, nullsFirst: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (learningLanguage) q = q.eq("language", learningLanguage);
      return q;
    };
    const first = await page(0, true);
    if (first.error) {
      console.error("Flashcards fetch failed", first.error);
      setLoadError(first.error.message);
      toast.error("Couldn't load your flashcards", { description: first.error.message });
      setLoading(false);
      return;
    }
    const rows: SavedWord[] = [...((first.data as SavedWord[]) || [])];
    const total = first.count ?? rows.length;
    if (total > pageSize) {
      const rest = await Promise.all(
        Array.from({ length: Math.ceil(total / pageSize) - 1 }, (_, i) => page((i + 1) * pageSize)),
      );
      for (const r of rest) if (!r.error) rows.push(...((r.data as SavedWord[]) || []));
    }
    // Coming from the video word counter: today's new words go first.
    if (new URLSearchParams(window.location.search).get("focus") === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const isToday = (r: any) => r.created_at && new Date(r.created_at) >= start;
      rows.sort((a, b) => Number(isToday(b)) - Number(isToday(a)));
    }
    setAllCards(rows);
    setLoading(false);
    try { localStorage.setItem(cacheKey, JSON.stringify(rows)); } catch { /* storage full: skip */ }
    setStarterDecks([]);
  }, [user, authLoading, learningLanguage]);

  // ?lang=fr (the Chrome extension's "Open your French flashcards" link) opens
  // that language's deck, if it's one of the learner's own languages.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lang = (params.get("lang") || "").toLowerCase();
    if (!user || !lang || lang === learningLanguage) return;
    let cancelled = false;
    supabase
      .from("language_profiles")
      .select("language")
      .eq("user_id", user.id)
      .eq("language", lang)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setLearningLanguage(lang);
      });
    return () => { cancelled = true; };
    // Only when the page opens or the account changes; switching language
    // afterwards on this page must not be undone by the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  // Realtime: re-fetch when the extension (or any other client) inserts a new
  // word OR changes a word's state (red → orange → green). Listening to both
  // events keeps deck counts and card colors in sync across every open tab,
  // device, and the Chrome extension without a manual refresh.
  // Requires saved_words to be in the supabase_realtime publication.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("saved_words_ext_inserts")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "saved_words",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchCards(false))
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "saved_words",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchCards(false))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCards]);

  // Reinforcement bonus when user arrives from "Review now" CTA after a video.
  useEffect(() => {
    if (consumeReinforcementPending()) {
      award("reinforcement");
    }
  }, [award]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchCards(false);
    setRefreshing(false);
  };

  const counts: Record<DeckKey, number> = {
    red: allCards.filter((c) => (c.state ?? "red") === "red").length,
    orange: allCards.filter((c) => c.state === "orange").length,
    green: allCards.filter((c) => c.state === "green").length,
  };

  // During the guided tour we deliberately scope each deck to a single card
  // (the freshly-saved tour word, which sits at the top thanks to the
  // state_changed_at desc order) so the user can always reach the
  // "review-close" step regardless of how big their real deck is.
  const openDeck = (deck: DeckKey) => {
    const cards = allCards.filter((c) => (c.state ?? "red") === deck);
    // A word that just moved up (red → orange, orange → green) goes to the
    // front of its new deck, so it's practised while it's fresh instead of
    // waiting behind older cards. Red keeps its due-date order.
    if (deck !== "red") {
      const movedAt = (c: SavedWord) => (c.state_changed_at ? Date.parse(c.state_changed_at) : 0);
      cards.sort((a, b) => movedAt(b) - movedAt(a));
    }
    setReviewCards(tourActive ? cards.slice(0, 1) : cards);
    setActiveDeck(deck);
  };

  const phraseCount = allCards.filter((c) => c.is_phrase).length;

  const flashcardData = reviewCards.map((c) => ({
    id: c.id,
    word: c.word,
    translation: c.translation,
    pronunciation: c.pronunciation,
    ipa: c.ipa,
    context: c.context,
    contextTranslation: c.contextTranslation,
    language: c.language,
    state: (c.state ?? "red") as DeckState,
    times_correct: c.times_correct ?? 0,
    is_phrase: !!c.is_phrase,
    ease_factor: c.ease_factor,
    interval_days: c.interval_days,
    review_count: c.review_count,
    image_url: c.image_url,
    lemma: c.lemma,
    lemma_translation: c.lemma_translation,
    is_inflected: c.is_inflected,
    grammar_note: c.grammar_note,
    pos: c.pos,
  }));

  if (activeDeck && flashcardData.length > 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <FlashcardReview
          cards={flashcardData}
          onCardReviewed={(id, patch) => {
            setAllCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...patch } : card)));
            setReviewCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...patch } : card)));
          }}
          onClose={() => { setActiveDeck(null); setReviewCards([]); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3">
          <Button data-tour="page-back" variant="ghost" size="icon" onClick={() => navigate("/discover")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Flashcards</h1>
          <div className="ml-auto flex items-center gap-2">
            <LevelBadge />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleManualRefresh}
              disabled={refreshing}
              title="Refresh deck counts"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </Button>
            <ActiveLanguageBadge />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {loading ? (
          <PageLoading />
        ) : (
          <>
            {loadError && (
              <section className="glass-panel-strong rounded-2xl p-4 border-destructive/40">
                <p className="text-sm font-semibold text-destructive">Flashcards could not be fetched.</p>
                <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
              </section>
            )}
            {allCards.length === 0 && (
              <section className="glass-panel-strong rounded-3xl p-8 text-center space-y-4">
                <div className="text-5xl">🧩</div>
                <h2 className="text-xl font-bold">No saved words yet</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Save words on Netflix using the LinguaScript Chrome extension to add flashcards here, or photograph a book page where you circled words.
                </p>
                <ScanPageButton onSaved={() => fetchCards(false)} />
                <Button asChild variant="default" size="lg">
                  <a
                    href="https://chromewebstore.google.com/search/linguascript"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get the Chrome Extension
                  </a>
                </Button>
              </section>
            )}
            {/* 3 deck cards */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-2xl font-bold">Your Decks</h2>
                <ScanPageButton onSaved={() => fetchCards(false)} className="ml-auto mr-3" />
                {phraseCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-400/40">
                    💜 {phraseCount} phrase{phraseCount === 1 ? "" : "s"} saved
                  </span>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                {(Object.keys(DECK_CONFIG) as DeckKey[]).map((key) => {
                  const cfg = DECK_CONFIG[key];
                  const n = counts[key];
                  const disabled = n === 0;
                  return (
                    <button
                      key={key}
                      data-tour={`deck-${key}`}
                      disabled={disabled}
                      onClick={() => openDeck(key)}
                      className={cn(
                        "rounded-3xl p-8 text-left text-white shadow-xl transition-transform",
                        "flex flex-col gap-3 min-h-[200px]",
                        disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.99]",
                      )}
                      style={{ backgroundColor: cfg.color }}
                    >
                      <div className="text-3xl">{cfg.emoji}</div>
                      <div className="text-xs font-bold tracking-widest opacity-90">{cfg.label}</div>
                      <div className="text-5xl font-black leading-none">{n}</div>
                      <div className="text-sm opacity-90">{cfg.subtitle}</div>
                      <div className="mt-auto inline-flex items-center gap-1 text-sm font-semibold">
                        {disabled ? "No cards yet" : cfg.cta} <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Most common words deck */}
            <button
              onClick={() => navigate("/flashcards/common")}
              className="w-full glass-panel-strong rounded-2xl p-5 flex items-center gap-4 text-left hover:border-primary/40 transition-colors"
            >
              <CommonWordsBadge language={learningLanguage || "fr"} />
              <div className="flex-1">
                <p className="font-bold text-foreground">Most common words</p>
                <p className="text-sm text-muted-foreground">Learn the words you'll hear most, in order.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Starter decks */}
            {false && starterDecks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-2xl font-bold">Starter Decks</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {starterDecks.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/flashcards/starter/${d.slug}`)}
                      className="glass-panel-strong rounded-2xl p-5 text-left hover:scale-[1.01] transition-transform flex items-center gap-4"
                    >
                      <div className="text-4xl">{d.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground truncate">{d.name}</div>
                        <div className="text-sm text-muted-foreground truncate">{d.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">{d.card_count} cards</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Flashcards;
