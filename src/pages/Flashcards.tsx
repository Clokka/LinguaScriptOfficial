import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardReview } from "@/components/FlashcardReview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getGuestWords } from "@/lib/guestWords";
import { DeckState } from "@/lib/vocab";
import { cn } from "@/lib/utils";
import { useTour } from "@/contexts/TourContext";
import { useXp } from "@/contexts/XpContext";
import { consumeReinforcementPending } from "@/lib/dailyVideo";

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
  red:    { label: "NEW",      subtitle: "Newly saved words",     color: "#FF3B30", emoji: "🔴", cta: "Review" },
  orange: { label: "LEARNING", subtitle: "Strengthening words",   color: "#FF8A00", emoji: "🟠", cta: "Review" },
  green:  { label: "LEARNED",  subtitle: "Mastered words",        color: "#34C759", emoji: "🟢", cta: "Browse" },
};

const Flashcards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { active: tourActive } = useTour();
  const { award } = useXp();
  const [allCards, setAllCards] = useState<SavedWord[]>([]);
  const [starterDecks, setStarterDecks] = useState<StarterDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeck, setActiveDeck] = useState<DeckKey | null>(null);
  const [reviewCards, setReviewCards] = useState<SavedWord[]>([]);

  const fetchCards = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    if (!user) {
      const guest = getGuestWords();
      setAllCards(guest as unknown as SavedWord[]);
    } else {
      const { data } = await supabase
        .from("saved_words")
        .select("id, word, translation, pronunciation, ipa, context, language, next_review, review_count, state, times_correct")
        .eq("user_id", user.id)
        .order("state_changed_at", { ascending: false, nullsFirst: false });
      setAllCards((data as SavedWord[]) || []);
    }

    // Starter decks with counts
    const { data: decks } = await supabase.from("starter_decks").select("id, slug, name, emoji, description, language").order("sort_order");
    if (decks) {
      const withCounts = await Promise.all(
        decks.map(async (d: any) => {
          const { count } = await supabase
            .from("starter_deck_cards")
            .select("id", { count: "exact", head: true })
            .eq("deck_id", d.id);
          return { ...d, card_count: count ?? 0 } as StarterDeck;
        }),
      );
      setStarterDecks(withCounts);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  // Reinforcement bonus when user arrives from "Review now" CTA after a video.
  useEffect(() => {
    if (consumeReinforcementPending()) {
      award("reinforcement");
    }
  }, [award]);

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
    setReviewCards(tourActive ? cards.slice(0, 1) : cards);
    setActiveDeck(deck);
  };

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
          <Button data-tour="page-back" variant="ghost" size="icon" onClick={() => navigate("/browse")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Flashcards</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* 3 deck cards */}
            <section>
              <h2 className="text-2xl font-bold mb-4">Your Decks</h2>
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

            {/* Starter decks */}
            {starterDecks.length > 0 && (
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
