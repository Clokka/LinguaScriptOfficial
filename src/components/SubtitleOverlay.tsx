import { useState } from "react";
import { cn } from "@/lib/utils";
import { WordPopup } from "./WordPopup";

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
}

export const SubtitleOverlay = ({
  primaryText,
  secondaryText,
  words,
  className,
  mode,
  onSaveWord,
}: SubtitleOverlayProps) => {
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  const handleWordClick = (word: Word, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
    setSelectedWord(word);
  };

  const renderWords = () => {
    const textWords = primaryText.split(" ");
    return textWords.map((text, index) => {
      const wordData = words.find(
        (w) => w.text.toLowerCase() === text.toLowerCase().replace(/[.,!?]/g, "")
      );
      return (
        <span
          key={index}
          className={cn(
            "subtitle-word",
            wordData && "cursor-pointer"
          )}
          onClick={(e) => wordData && handleWordClick(wordData, e)}
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
          "glass-panel-strong px-8 py-4 text-center max-w-4xl mx-auto",
          className
        )}
      >
        <p className="subtitle-text text-foreground leading-relaxed">
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
          onClose={() => setSelectedWord(null)}
          onSave={() => {
            console.log("Saved:", selectedWord);
            setSelectedWord(null);
          }}
        />
      )}
    </>
  );
};
