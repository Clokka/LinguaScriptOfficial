import { useState } from "react";
import { Volume2, Check, X, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DeckState } from "@/lib/vocab";

/** Same hexes as the subtitle overlay — one word, one colour, everywhere. */
const DECK_COLORS: Record<DeckState, string> = {
  red: "#FF3B30",
  orange: "#FF8A00",
  green: "#34C759",
};

/** Chinese cards lead with the characters and carry pinyin underneath. */
const isChinese = (lang?: string) => !!lang && lang.toLowerCase().startsWith("zh");

interface FlashcardProps {
  word: string;
  translation: string;
  pronunciation: string;
  ipa: string;
  context?: string;
  contextTranslation?: string;
  imageUrl?: string;
  language?: string;
  /** Deck the card lives in — the word and its pinyin render in this colour. */
  state?: DeckState;
  direction?: "learn-to-native" | "native-to-learn";
  onCorrect: () => void;
  onIncorrect: () => void;
}

export const Flashcard = ({
  word,
  translation,
  pronunciation,
  ipa,
  context,
  contextTranslation,
  imageUrl,
  language,
  state,
  direction = "learn-to-native",
  onCorrect,
  onIncorrect,
}: FlashcardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const { speak } = useLanguage();

  const handleFlip = () => setIsFlipped(!isFlipped);

  const deckColor = state ? DECK_COLORS[state] : undefined;
  // For Chinese the "phonetic" line is pinyin, and it must read as clearly as
  // the character it belongs to — it is the pronunciation, not a footnote.
  const romanisation = isChinese(language) ? (ipa || pronunciation) : "";

  // Determine which side shows what based on direction
  const showLearningFirst = direction === "learn-to-native";
  const frontLabel = showLearningFirst ? "Learning Language" : "Your Language";
  const frontText = showLearningFirst ? word : translation;
  const frontSub = showLearningFirst ? ipa : pronunciation;
  const backLabel = showLearningFirst ? "Your Language" : "Learning Language";
  const backText = showLearningFirst ? translation : word;
  const backSub = showLearningFirst ? pronunciation : ipa;
  const frontHint = showLearningFirst ? "Tap to reveal translation" : "Tap to reveal the word";


  return (
    <div className="flashcard-container w-full max-w-md mx-auto">
      <div
        data-tour="flashcard"
        className={cn("flashcard w-full h-72 cursor-pointer select-none", isFlipped && "flipped")}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        onClick={handleFlip}
      >
        {/* Front */}
        <div className="flashcard-face glass-panel-strong p-8 flex flex-col items-center justify-center shadow-float">
          <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-2">{frontLabel}</p>
          {imageUrl && showLearningFirst && (
            <img src={imageUrl} alt={word} className="w-28 h-28 object-cover rounded-2xl mb-3 shadow-md" />
          )}
          <p
            className={cn(
              "mb-2",
              showLearningFirst ? "text-4xl font-bold" : "text-3xl font-bold text-foreground",
              showLearningFirst && !deckColor && "gradient-text",
            )}
            style={showLearningFirst && deckColor ? { color: deckColor } : undefined}
          >
            {frontText || "—"}
          </p>
          {showLearningFirst && romanisation ? (
            /* Pinyin carries the same deck colour as its character. */
            <p
              className="text-xl font-semibold"
              style={deckColor ? { color: deckColor, opacity: 0.85 } : undefined}
            >
              {romanisation}
            </p>
          ) : (
            <p className="text-muted-foreground text-lg">{frontSub}</p>
          )}

          {context && showLearningFirst && (
            <div className="mt-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground italic">"{context}"</p>
            </div>
          )}
          {contextTranslation && !showLearningFirst && (
            <div className="mt-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground italic">"{contextTranslation}"</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-6">{frontHint}</p>
        </div>

        {/* Back */}
        <div className="flashcard-face flashcard-back glass-panel-strong p-8 flex flex-col items-center justify-center shadow-float">
          <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-2">{backLabel}</p>
          <p className={cn("mb-3", showLearningFirst ? "text-3xl font-bold text-foreground" : "text-4xl font-bold gradient-text")}>
            {backText || "—"}
          </p>
          <p className="text-muted-foreground">{backSub}</p>
          {context && (
            <div className="mt-4 text-center space-y-1 border-t border-border/30 pt-3">
              <p className="text-sm font-medium text-foreground/80 italic">"{context}"</p>
              {contextTranslation && (
                <p className="text-xs text-muted-foreground">"{contextTranslation}"</p>
              )}
            </div>
          )}
          <Button
            data-tour="flashcard-pronounce"
            variant="glass"
            size="icon"
            className="mt-4"
            onClick={(e) => {
              e.stopPropagation();
              speak(word, language);
            }}
          >
            <Volume2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Actions - only show when flipped */}
      {isFlipped && (
        <div className="flex justify-center gap-4 mt-6 animate-fade-in">
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setIsFlipped(false);
              onIncorrect();
            }}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <X className="w-5 h-5 mr-2" />
            Again
          </Button>
          <Button
            variant="glass"
            size="icon-lg"
            onClick={() => setIsFlipped(false)}
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          <Button
            data-tour="flashcard-got-it"
            variant="success"
            size="lg"
            onClick={() => {
              setIsFlipped(false);
              onCorrect();
            }}
          >
            <Check className="w-5 h-5 mr-2" />
            Got it!
          </Button>
        </div>
      )}
    </div>
  );
};
