import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, BookOpen, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardReview } from "@/components/FlashcardReview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SavedWord {
  id: string;
  word: string;
  translation: string;
  pronunciation: string;
  ipa: string;
  context: string;
  next_review: string;
  review_count: number;
}

const Flashcards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dueCards, setDueCards] = useState<SavedWord[]>([]);
  const [allCards, setAllCards] = useState<SavedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [mode, setMode] = useState<"due" | "all">("due");

  const fetchCards = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const today = new Date().toISOString().split("T")[0];

    // Also fetch user's language settings for translation
    const [dueRes, allRes, profileRes] = await Promise.all([
      supabase
        .from("saved_words")
        .select("id, word, translation, pronunciation, ipa, context, language, next_review, review_count")
        .eq("user_id", user.id)
        .lte("next_review", today)
        .order("next_review", { ascending: true }),
      supabase
        .from("saved_words")
        .select("id, word, translation, pronunciation, ipa, context, language, next_review, review_count")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("native_language, learning_language")
        .eq("user_id", user.id)
        .single(),
    ]);

    const allWords = (allRes.data as SavedWord[]) || [];
    const dueWords = (dueRes.data as SavedWord[]) || [];
    const nativeLang = profileRes.data?.native_language || "en";

    // Auto-translate any words missing translations
    const wordsNeedingTranslation = allWords.filter(w => !w.translation || w.translation.trim() === '');
    if (wordsNeedingTranslation.length > 0) {
      console.log(`Auto-translating ${wordsNeedingTranslation.length} words missing translations...`);
      const { getLanguageLabel: getLangLabel } = await import("@/lib/languages");

      // Translate up to 10 at a time to avoid overwhelming
      for (const word of wordsNeedingTranslation.slice(0, 10)) {
        try {
          const fromLang = getLangLabel(word.language || "fr");
          const toLang = getLangLabel(nativeLang);
          const { data, error } = await supabase.functions.invoke("translate-word", {
            body: { word: word.word, context: word.context || "", fromLanguage: fromLang, toLanguage: toLang },
          });
          if (!error && data?.translation) {
            await supabase.from("saved_words").update({
              translation: data.translation,
              pronunciation: data.pronunciation || "",
              ipa: data.ipa || "",
            }).eq("id", word.id);
            // Update in-memory
            word.translation = data.translation;
            word.pronunciation = data.pronunciation || "";
            word.ipa = data.ipa || "";
          }
        } catch (e) {
          console.error("Auto-translate failed for:", word.word, e);
        }
      }
    }

    setDueCards(dueWords.map(dw => {
      const updated = allWords.find(a => a.id === dw.id);
      return updated || dw;
    }));
    setAllCards([...allWords]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleClose = () => {
    setReviewing(false);
    fetchCards();
  };

  const cards = mode === "due" ? dueCards : allCards;
  const flashcardData = cards.map((c) => ({
    id: c.id,
    word: c.word,
    translation: c.translation,
    pronunciation: c.pronunciation,
    ipa: c.ipa,
    context: c.context,
  }));

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to access your flashcards</p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (reviewing && flashcardData.length > 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <FlashcardReview cards={flashcardData} onClose={handleClose} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/browse")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Flashcards</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel-strong p-5 rounded-2xl text-center">
            <p className="text-3xl font-bold gradient-text">{dueCards.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Due Today</p>
          </div>
          <div className="glass-panel-strong p-5 rounded-2xl text-center">
            <p className="text-3xl font-bold text-foreground">{allCards.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Words</p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === "due" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("due")}
            className="gap-2"
          >
            <BookOpen className="w-4 h-4" /> Due ({dueCards.length})
          </Button>
          <Button
            variant={mode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("all")}
            className="gap-2"
          >
            <Layers className="w-4 h-4" /> All ({allCards.length})
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : cards.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {mode === "due"
                ? "No flashcards due! Click words in subtitles to save them."
                : "No saved words yet. Click any word in a subtitle to save it."}
            </p>
          </div>
        ) : (
          <Button
            onClick={() => setReviewing(true)}
            className="w-full h-14 rounded-xl bg-gradient-to-r from-primary to-[hsl(280,100%,60%)] text-primary-foreground font-semibold text-lg gap-2"
          >
            <BookOpen className="w-5 h-5" />
            Review {cards.length} {mode === "due" ? "Due" : ""} Cards
          </Button>
        )}
      </div>
    </div>
  );
};

export default Flashcards;
