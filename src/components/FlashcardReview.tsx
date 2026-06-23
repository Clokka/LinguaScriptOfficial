import { useState, useEffect, useRef } from "react";
import { Flashcard } from "./Flashcard";
import { Button } from "./ui/button";
import { X, ChevronLeft, ChevronRight, Trophy, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DeckState, nextState } from "@/lib/vocab";
import { useXp } from "@/contexts/XpContext";

type Direction = "learn-to-native" | "native-to-learn";
const DIR_KEY = "flashcardDirection";

interface FlashcardData {
  id: string;
  word: string;
  translation: string;
  pronunciation: string;
  ipa: string;
  context?: string;
  contextTranslation?: string;
  language?: string;
  state?: DeckState;
  times_correct?: number;
}

interface FlashcardReviewProps {
  cards: FlashcardData[];
  onClose: () => void;
  onCardReviewed?: (id: string, patch: Pick<FlashcardData, "state" | "times_correct">) => void;
  className?: string;
}

export const FlashcardReview = ({ cards: initialCards, onClose, onCardReviewed, className }: FlashcardReviewProps) => {
  const { user } = useAuth();
  const { award } = useXp();
  const sessionBonusFired = useRef(false);
  const [cards, setCards] = useState<FlashcardData[]>(initialCards);
  useEffect(() => { setCards(initialCards); }, [initialCards]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [direction, setDirection] = useState<Direction>(() => {
    return (localStorage.getItem(DIR_KEY) as Direction) || "native-to-learn";
  });
  // DB writes fire in the background — we never block the UI on them.
  const pendingWrites = useRef<Promise<unknown>[]>([]);
  const handleClose = () => {
    // Don't await: writes are already in flight, parent state is already correct.
    onClose();
  };

  useEffect(() => { localStorage.setItem(DIR_KEY, direction); }, [direction]);

  const toggleDirection = () => {
    setDirection((d) => (d === "learn-to-native" ? "native-to-learn" : "learn-to-native"));
  };

  const logReview = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("activity_log")
      .select("id, words_reviewed")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("activity_log")
        .update({ words_reviewed: ((existing as any).words_reviewed || 0) + 1 } as any)
        .eq("id", existing.id);
    } else {
      await supabase.from("activity_log").insert({
        user_id: user.id,
        date: today,
        words_reviewed: 1,
        minutes_watched: 0,
        videos_watched: 0,
      } as any);
    }
  };

  const promoteDeckState = (wasCorrect: boolean) => {
    const card = cards[currentIndex];
    if (!card) return;
    const prevState = (card.state ?? "red") as DeckState;
    const prevTimes = card.times_correct ?? 0;
    const newTimes = prevTimes + (wasCorrect ? 1 : 0);
    const newState = nextState(prevState, newTimes, wasCorrect);
    // Optimistic local update — React is only a temporary UI cache.
    setCards((prev) => prev.map((c, i) => (i === currentIndex ? { ...c, state: newState, times_correct: newTimes } : c)));
    onCardReviewed?.(card.id, { state: newState, times_correct: newTimes });

    // Persist the SRS transition immediately. Supabase saved_words.state is the source of truth.
    if (user && !card.id.startsWith("guest-")) {
      const patch: Record<string, unknown> = {
        state: newState,
        times_correct: newTimes,
      };
      if (newState !== prevState) patch.state_changed_at = new Date().toISOString();

      const p = Promise.resolve(
        supabase
          .from("saved_words")
          .update(patch as any)
          .eq("id", card.id)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle(),
      ).then(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error(`No saved_words row updated for ${card.id}`);
      }).catch((error) => {
          console.error("[SRS] failed to persist deck transition", error);
      });
      pendingWrites.current.push(p);
      p.finally(() => {
        pendingWrites.current = pendingWrites.current.filter((write) => write !== p);
      });
    }
  };

  const advance = (totalReviewed: number) => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsComplete(true);
      if (!sessionBonusFired.current) {
        sessionBonusFired.current = true;
        award("session_end", { cards: totalReviewed });
      }
    }
  };

  const handleCorrect = () => {
    setCorrect((prev) => prev + 1);
    void logReview();
    award("review_card", { correct: true });
    promoteDeckState(true);
    advance(correct + incorrect + 1);
  };

  const handleIncorrect = () => {
    setIncorrect((prev) => prev + 1);
    void logReview();
    award("review_card", { correct: false });
    promoteDeckState(false);
    advance(correct + incorrect + 1);
  };

  const progress = ((currentIndex + (isComplete ? 1 : 0)) / cards.length) * 100;
  const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0;

  if (isComplete) {
    return (
      <div className={cn("glass-panel-strong p-8 max-w-md mx-auto text-center", className)}>
        <div className="w-20 h-20 rounded-full bg-gradient-accent flex items-center justify-center mx-auto mb-6 shadow-glow-accent animate-bounce-in">
          <Trophy className="w-10 h-10 text-accent-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Review Complete!</h2>
        <p className="text-muted-foreground mb-6">Great job keeping up with your vocabulary</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass-panel p-4">
            <p className="text-2xl font-bold text-foreground">{cards.length}</p>
            <p className="text-xs text-muted-foreground">Cards</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-2xl font-bold text-success">{correct}</p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-2xl font-bold gradient-text">{accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button data-tour="review-close" variant="outline" className="flex-1" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant="hero"
            className="flex-1"
            onClick={() => {
              setCurrentIndex(0);
              setCorrect(0);
              setIncorrect(0);
              setIsComplete(false);
            }}
          >
            Review Again
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className={cn("max-w-lg mx-auto", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button data-tour="page-back" variant="ghost" size="icon" onClick={handleClose}>
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {cards.length}
          </span>
          <div className="flex gap-2">
            <span className="text-sm text-success">{correct} ✓</span>
            <span className="text-sm text-destructive">{incorrect} ✗</span>
          </div>
        </div>
        <div className="w-10" />
      </div>

      {/* Direction toggle */}
      <div className="flex justify-center mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleDirection}
          className="gap-2 rounded-full text-xs"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {direction === "native-to-learn" ? "English → French" : "French → English"}
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-gradient-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flashcard */}
      <Flashcard
        key={currentCard.id + direction}
        word={currentCard.word}
        translation={currentCard.translation}
        pronunciation={currentCard.pronunciation}
        ipa={currentCard.ipa}
        context={currentCard.context}
        contextTranslation={currentCard.contextTranslation}
        language={currentCard.language}
        direction={direction}
        onCorrect={handleCorrect}
        onIncorrect={handleIncorrect}
      />


      {/* Navigation */}
      <div className="flex justify-center gap-4 mt-8">
        <Button
          variant="glass"
          size="icon"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => prev - 1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="glass"
          size="icon"
          disabled={currentIndex === cards.length - 1}
          onClick={() => setCurrentIndex((prev) => prev + 1)}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
