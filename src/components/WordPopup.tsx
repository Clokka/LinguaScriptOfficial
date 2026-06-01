import { X, Volume2, BookmarkPlus, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface Word {
  id: string;
  text: string;
  translation: string;
  pronunciation: string;
  ipa: string;
}

interface WordPopupProps {
  word: Word;
  position: { x: number; y: number };
  onClose: () => void;
  onSave: () => void;
}

export const WordPopup = ({ word, position, onClose, onSave }: WordPopupProps) => {
  const { speak } = useLanguage();
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div
        className={cn(
          "fixed z-50 glass-panel-strong p-5 w-80 animate-scale-in",
          "shadow-float"
        )}
        style={{
          left: Math.min(position.x - 160, window.innerWidth - 340),
          top: Math.max(position.y - 200, 20),
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-4">
          {/* Word header */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-2xl font-bold gradient-text">{word.text}</h3>
              <p className="text-muted-foreground text-sm mt-1">{word.ipa}</p>
            </div>
            <Button
              data-tour="word-pronounce"
              variant="glass"
              size="icon-sm"
              onClick={() => speak(word.text)}
            >
              <Volume2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Translation */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Translation
            </p>
            <p className="text-foreground font-medium">{word.translation}</p>
          </div>

          {/* Pronunciation guide */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Pronunciation
            </p>
            <p className="text-foreground">{word.pronunciation}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              data-tour="word-save"
              variant="success"
              className="flex-1"
              onClick={onSave}
            >
              <BookmarkPlus className="w-4 h-4" />
              Save to Flashcards
            </Button>
            <Button variant="glass" size="icon">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
