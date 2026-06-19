import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, BookOpen, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardReview } from "@/components/FlashcardReview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DeckState, STATE_META, normalizeToken } from "@/lib/vocab";
import { toast } from "sonner";

interface DeckRow { id: string; slug: string; name: string; emoji: string; description: string; language: string; }
interface CardRow { id: string; position: number; word: string; translation: string; reading: string; ipa: string; }
interface SavedRow { id: string; word: string; state: DeckState; times_correct: number; }

const StarterDeck = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deck, setDeck] = useState<DeckRow | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [savedByWord, setSavedByWord] = useState<Map<string, SavedRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const { data: d } = await supabase.from("starter_decks").select("*").eq("slug", slug).maybeSingle();
    if (!d) { setLoading(false); return; }
    setDeck(d as DeckRow);
    const { data: cs } = await supabase
      .from("starter_deck_cards").select("*").eq("deck_id", (d as any).id).order("position");
    setCards((cs as CardRow[]) || []);

    if (user) {
      const { data: saved } = await supabase
        .from("saved_words")
        .select("id, word, state, times_correct")
        .eq("user_id", user.id)
        .eq("language", (d as any).language);
      const map = new Map<string, SavedRow>();
      for (const r of (saved as SavedRow[]) || []) map.set(normalizeToken(r.word), r);
      setSavedByWord(map);
    }
    setLoading(false);
  }, [slug, user]);

  useEffect(() => { load(); }, [load]);

  const ensureSavedForReview = async (): Promise<{ id: string; word: string; translation: string; pronunciation: string; ipa: string; context: string; state: DeckState; times_correct: number; }[] | null> => {
    if (!user) {
      toast.error("Sign in to review starter decks");
      navigate("/auth");
      return null;
    }
    if (!deck) return null;
    // Upsert any missing cards into saved_words as 'orange' (learning)
    const missing = cards.filter((c) => !savedByWord.has(normalizeToken(c.word)));
    if (missing.length > 0) {
      const rows = missing.map((c) => ({
        user_id: user.id,
        word: c.word,
        translation: c.translation,
        pronunciation: c.reading || "",
        ipa: c.ipa || "",
        context: "",
        language: deck.language,
        state: "orange" as DeckState,
      }));
      await supabase.from("saved_words").upsert(rows as any, { onConflict: "user_id,word,language", ignoreDuplicates: true });
    }
    const { data: saved } = await supabase
      .from("saved_words")
      .select("id, word, state, times_correct, translation, pronunciation, ipa")
      .eq("user_id", user.id)
      .eq("language", deck.language);
    const map = new Map<string, any>();
    for (const r of (saved as any[]) || []) map.set(normalizeToken(r.word), r);
    setSavedByWord(map as any);
    return cards.map((c) => {
      const s = map.get(normalizeToken(c.word));
      return {
        id: s?.id ?? c.id,
        word: c.word,
        translation: s?.translation || c.translation,
        pronunciation: s?.pronunciation || c.reading,
        ipa: s?.ipa || c.ipa,
        context: "",
        state: (s?.state ?? "red") as DeckState,
        times_correct: s?.times_correct ?? 0,
      };
    });
  };

  const [reviewCards, setReviewCards] = useState<any[]>([]);

  const startReview = async () => {
    const list = await ensureSavedForReview();
    if (!list) return;
    setReviewCards(list);
    setReviewing(true);
  };

  if (reviewing && reviewCards.length > 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <FlashcardReview cards={reviewCards} onClose={() => { setReviewing(false); load(); }} />
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!deck) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Deck not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/flashcards")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">{deck.emoji} {deck.name}</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="glass-panel-strong rounded-2xl p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground">{deck.description}</p>
            <p className="text-sm text-muted-foreground mt-1">{cards.length} cards</p>
          </div>
          <Button size="lg" onClick={startReview} className="gap-2">
            <BookOpen className="w-5 h-5" /> Review Deck
          </Button>
        </div>

        <div className="grid gap-2">
          {cards.map((c) => {
            const saved = savedByWord.get(normalizeToken(c.word));
            const state = (saved?.state ?? null) as DeckState | null;
            return (
              <div key={c.id} className="glass-panel rounded-xl p-4 flex items-center gap-4">
                {state ? (
                  <span className={`w-3 h-3 rounded-full ${STATE_META[state].dot}`} />
                ) : (
                  <span className="w-3 h-3 rounded-full bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground">{c.word}</div>
                  {c.reading && <div className="text-xs text-muted-foreground">{c.reading}</div>}
                </div>
                <div className="text-sm text-muted-foreground truncate max-w-[40%]">{c.translation}</div>
                {state ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Plus className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StarterDeck;
