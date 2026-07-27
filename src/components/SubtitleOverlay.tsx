import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { WordPopup } from "./WordPopup";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { getLanguageLabel } from "@/lib/languages";
import {
  DeckState,
  SavedWordLite,
  loadDeckIndex,
  normalizeToken,
} from "@/lib/vocab";
import { greenScoreForLine } from "@/lib/understanding";

interface Word {
  id: string;
  text: string;
  translation: string;
  pronunciation: string;
  ipa: string;
}

interface SubtitleOverlayProps {
  primaryText: string;
  secondaryText?: string;
  words: Word[];
  className?: string;
  mode: "single" | "dual";
  onSaveWord?: (word: Word) => void;
  onSavePhrase?: (phrase: string) => void;
  onMarkKnown?: (word: Word) => void;
  nativeLanguage?: string;
  contentLanguage?: string;
}

// Canonical LinguaScript deck palette. These hexes MUST stay identical to
// DECK_CONFIG in src/pages/Flashcards.tsx and to .ls-red/.ls-orange/.ls-green
// in the Chrome extension, so a word's colour in the script is exactly its
// flashcard deck colour across every surface (website, Netflix, YouTube).
// Brand voice 🦎: red (unknown) → orange (learning) → green (known).
const DECK_COLORS: Record<DeckState, string> = {
  red: "#FF3B30",
  orange: "#FF8A00",
  green: "#34C759",
};

export const SubtitleOverlay = ({
  primaryText,
  secondaryText,
  words,
  className,
  mode,
  onSaveWord,
  onSavePhrase,
  onMarkKnown,
  nativeLanguage,
  contentLanguage,
}: SubtitleOverlayProps) => {
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [, setTranslating] = useState(false);
  const { languageContext } = useLanguage();
  // The deck — and every word interaction below — is scoped to the
  // language actually on screen. Prefer the explicit `contentLanguage`
  // prop from the player; only fall back to languageContext when the
  // caller hasn't tagged the content yet.
  const effectiveLang = contentLanguage || languageContext;
  const { user } = useAuth();
  const [deck, setDeck] = useState<Map<string, SavedWordLite>>(new Map());

  useEffect(() => {
    let alive = true;
    loadDeckIndex(user?.id ?? null, effectiveLang).then((m) => {
      if (alive) setDeck(m);
    });
    return () => { alive = false; };
  }, [user, effectiveLang]);

  const stateForToken = (text: string): DeckState | undefined => {
    return deck.get(normalizeToken(text))?.state;
  };

  const handleWordClick = async (word: Word, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });

    if (word.translation) {
      setSelectedWord(word);
      return;
    }

    setSelectedWord({ ...word, translation: "Translating...", pronunciation: "", ipa: "" });
    setTranslating(true);

    try {
      const fromLang = getLanguageLabel(effectiveLang);
      const toLang = getLanguageLabel(nativeLanguage || "en");

      const { data, error } = await supabase.functions.invoke("translate-word", {
        body: { word: word.text, context: primaryText, fromLanguage: fromLang, toLanguage: toLang },
      });

      if (!error && data) {
        const translated = {
          ...word,
          translation: data.translation || "",
          pronunciation: data.pronunciation || "",
          ipa: data.ipa || "",
        };
        setSelectedWord(translated);
        word.translation = translated.translation;
        word.pronunciation = translated.pronunciation;
        word.ipa = translated.ipa;
      }
    } catch (e) {
      console.error("Word translation failed:", e);
    } finally {
      setTranslating(false);
    }
  };

  // Per-line green % using the weighted understanding model.
  const greenScore = useMemo(
    () => greenScoreForLine(primaryText, effectiveLang, deck),
    [primaryText, effectiveLang, deck],
  );

  const renderWords = () => {
    const textWords = primaryText.split(" ");
    return textWords.map((text, index) => {
      const wordData = words.find(
        (w) => w.text.toLowerCase() === text.toLowerCase().replace(/[.,!?]/g, "")
      );
      const deckState = stateForToken(text);
      // Saved words render in their exact deck colour (red/orange/green);
      // unknown words stay bright white to draw the eye.
      const deckColor = deckState ? DECK_COLORS[deckState] : undefined;
      return (
        <span
          key={index}
          data-tour={wordData ? "subtitle-word" : undefined}
          className={cn(
            "subtitle-word inline-flex items-baseline",
            wordData && "cursor-pointer",
            deckColor ? "font-semibold" : "text-white font-medium",
          )}
          style={deckColor ? { color: deckColor } : undefined}
          onClick={(e) => {
            if (wordData) handleWordClick(wordData, e);
          }}
        >
          {text}
          {index < textWords.length - 1 && " "}
        </span>
      );
    });
  };

  return (
    <>
      <div
        className={cn(
          "glass-panel-strong px-8 py-4 text-center max-w-4xl mx-auto relative",
          className
        )}
      >
        {greenScore.totalCount > 0 && (
          <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 backdrop-blur">
            {greenScore.pct}% green
          </div>
        )}
        {onSavePhrase && primaryText.trim() && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSavePhrase(primaryText.trim());
            }}
            className="absolute -top-3 left-4 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-200 border border-purple-400/40 backdrop-blur hover:bg-purple-500/40 transition-colors"
            title="Save this whole line as a phrase flashcard"
          >
            + Save phrase
          </button>
        )}
        <p className="subtitle-text leading-relaxed">
          {renderWords()}
        </p>
        {mode === "dual" && secondaryText && (
          <p className="text-lg text-muted-foreground mt-2 font-light">
            {secondaryText}
          </p>
        )}
      </div>


      {selectedWord && (
        <WordPopup
          word={selectedWord}
          position={popupPosition}
          language={effectiveLang}
          onClose={() => setSelectedWord(null)}
          onSave={() => {
            if (onSaveWord && selectedWord) onSaveWord(selectedWord);
            // Optimistic local update so the word turns red (UNKNOWN — newly
            // saved) immediately, mirroring the green update for "mark known".
            if (selectedWord) {
              setDeck((prev) => {
                const next = new Map(prev);
                const key = normalizeToken(selectedWord.text);
                const existing = next.get(key);
                next.set(key, {
                  id: existing?.id || selectedWord.id,
                  word: selectedWord.text,
                  language: effectiveLang,
                  state: existing?.state ?? "red",
                  times_correct: existing?.times_correct ?? 0,
                  review_count: existing?.review_count ?? 0,
                });
                return next;
              });
            }
            setSelectedWord(null);
          }}
          onMarkKnown={
            onMarkKnown
              ? () => {
                  if (selectedWord) {
                    onMarkKnown(selectedWord);
                    // Optimistic local update so the word turns green immediately.
                    setDeck((prev) => {
                      const next = new Map(prev);
                      const key = normalizeToken(selectedWord.text);
                      const existing = next.get(key);
                      next.set(key, {
                        id: existing?.id || selectedWord.id,
                        word: selectedWord.text,
                        language: effectiveLang,
                        state: "green",
                        times_correct: existing?.times_correct ?? 0,
                        review_count: existing?.review_count ?? 0,
                      });
                      return next;
                    });
                  }
                  setSelectedWord(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
};
