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
  language?: string;
  onClose: () => void;
  onSave: () => void;
}

export const WordPopup = ({ word, position, language, onClose, onSave }: WordPopupProps) => {
  const { speak } = useLanguage();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
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
          "fixed z-50 glass-panel-strong animate-scale-in shadow-float",
          "p-4 md:p-5",
          // Mobile: pin to bottom of viewport so it sits below video + subtitles, not over them
          "left-3 right-3 bottom-3 md:left-auto md:right-auto md:bottom-auto",
          "md:w-80",
          "text-[clamp(12px,3.6vw,16px)] md:text-base",
          "max-h-[55vh] overflow-y-auto md:max-h-none md:overflow-visible"
        )}
        style={
          isMobile
            ? { paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }
            : {
                left: Math.max(16, Math.min(position.x - 160, window.innerWidth - 340)),
                top: Math.min(
                  Math.max(position.y - 200, 16),
                  window.innerHeight - 360,
                ),
              }
        }
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
