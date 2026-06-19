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
  nativeLanguage?: string;
  contentLanguage?: string;
}

// LinguaScript visual identity: green words = understood (dim, low-attention);
// every other token = unknown (bright white, high-attention). Orange/red flash
// only briefly via a small status dot for cards the learner is actively
// reviewing — they should NOT compete with the green-vs-white contrast.
const STATE_TEXT: Partial<Record<DeckState, string>> = {
  green: "text-emerald-400/70",
};

export const SubtitleOverlay = ({
  primaryText,
  secondaryText,
  words,
  className,
  mode,
  onSaveWord,
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
      const isGreen = deckState === "green";
      const colorClass = isGreen
        ? STATE_TEXT.green
        : "text-white font-medium"; // unknown / learning → bright, draws the eye
      return (
        <span
          key={index}
          data-tour={wordData ? "subtitle-word" : undefined}
          className={cn(
            "subtitle-word inline-flex items-baseline",
            wordData && "cursor-pointer",
            colorClass,
          )}
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
            setSelectedWord(null);
          }}
        />
      )}
    </>
  );
};
