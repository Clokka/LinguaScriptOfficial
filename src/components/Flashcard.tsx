import { useState } from "react";
import { Volume2, Check, X, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface FlashcardProps {
  word: string;
  translation: string;
  pronunciation: string;
  ipa: string;
  context?: string;
  contextTranslation?: string;
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
  onCorrect,
  onIncorrect,
}: FlashcardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const { speak } = useLanguage();

  const handleFlip = () => setIsFlipped(!isFlipped);

  return (
    <div className="flashcard-container w-full max-w-md mx-auto">
      <div
        className={cn("flashcard w-full h-72 cursor-pointer", isFlipped && "flipped")}
        onClick={handleFlip}
      >
        {/* Front — Learning language (word to learn) */}
        <div className="flashcard-face glass-panel-strong p-8 flex flex-col items-center justify-center shadow-float">
          <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-2">Learning Language</p>
          <p className="text-4xl font-bold gradient-text mb-4">{word}</p>
          <p className="text-muted-foreground text-lg">{ipa}</p>
          {context && (
            <div className="mt-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground italic">"{context}"</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-6">Tap to reveal translation</p>
        </div>

        {/* Back — User's native language (translation) */}
        <div className="flashcard-face flashcard-back glass-panel-strong p-8 flex flex-col items-center justify-center shadow-float">
          <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-2">Your Language</p>
          <p className="text-3xl font-bold text-foreground mb-3">{translation}</p>
          <p className="text-muted-foreground">{pronunciation}</p>
          <Button
            variant="glass"
            size="icon"
            className="mt-4"
            onClick={(e) => {
              e.stopPropagation();
              speak(word);
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
              setTimeout(onIncorrect, 300);
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
            variant="success"
            size="lg"
            onClick={() => {
              setIsFlipped(false);
              setTimeout(onCorrect, 300);
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
