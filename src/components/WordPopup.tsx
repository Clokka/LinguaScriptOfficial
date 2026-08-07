import { X, Volume2, BookmarkPlus, CheckCircle2, Loader2 } from "lucide-react";
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
  translating?: boolean;
  onClose: () => void;
  onSave: () => void;
  onMarkKnown?: () => void;
}

export const WordPopup = ({ word, position, language, translating, onClose, onSave, onMarkKnown }: WordPopupProps) => {
  const { speak } = useLanguage();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className={cn(
          "fixed z-50 glass-panel-strong animate-scale-in shadow-float",
          "p-4 md:p-5",
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
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-2xl font-bold gradient-text">{word.text}</h3>
              <p className="text-muted-foreground text-sm mt-1">{word.ipa}</p>
            </div>
            <Button
              data-tour="word-pronounce"
              variant="glass"
              size="icon-sm"
              onClick={() => speak(word.text, language)}
            >
              <Volume2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Translation
            </p>
            <p className="text-foreground font-medium">{word.translation}</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Pronunciation
            </p>
            <p className="text-foreground">{word.pronunciation}</p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {onMarkKnown && (
              <Button
                variant="glass"
                className="w-full border border-emerald-500/40 text-emerald-300 hover:text-emerald-200"
                onClick={onMarkKnown}
                disabled={translating}
              >
                <CheckCircle2 className="w-4 h-4" />
                I already know this — mark as known
              </Button>
            )}
            <Button
              data-tour="word-save"
              variant="success"
              className="w-full"
              onClick={onSave}
              disabled={translating}
            >
              {translating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BookmarkPlus className="w-4 h-4" />
              )}
              {translating ? "Translating…" : "Save to Flashcards"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
