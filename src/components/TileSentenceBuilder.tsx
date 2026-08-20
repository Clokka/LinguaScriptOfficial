// Tile Builder — assemble the sentence from its own scrambled words, tap by
// tap. Checked with LanguageTool rather than a strict order match, since more
// than one arrangement of the same tiles can be genuinely correct; when it
// isn't, LanguageTool's match offset tells us exactly which word to
// underline instead of just flashing "wrong".
import { useCallback, useMemo, useState } from "react";
import { WordBlock } from "@/components/blocks/WordBlock";
import { Button } from "@/components/ui/button";
import { ArrowRight, RotateCcw } from "lucide-react";
import confetti from "canvas-confetti";
import { checkGrammar, positionalMismatch, splitByMatches, type GrammarMatch } from "@/lib/grammarCheck";

interface Tile {
  id: string;
  label: string;
}

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

const tokenize = (sentence: string): Tile[] =>
  sentence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((label, i) => ({ id: `${i}-${label}`, label }));

export interface TileSentenceBuilderProps {
  /** The known-correct sentence — also the source of the tiles. */
  sentence: string;
  translation?: string;
  language: string;
  onComplete: (data: { correct: boolean; xpEarned: number }) => void;
  onSkip: () => void;
}

export function TileSentenceBuilder({
  sentence,
  translation,
  language,
  onComplete,
  onSkip,
}: TileSentenceBuilderProps) {
  const initialTiles = useMemo(() => shuffle(tokenize(sentence)), [sentence]);
  const [tray, setTray] = useState<Tile[]>(initialTiles);
  const [built, setBuilt] = useState<Tile[]>([]);
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<GrammarMatch[] | null>(null);
  const [solved, setSolved] = useState(false);

  const addTile = useCallback((tile: Tile) => {
    if (checking || solved) return;
    setMatches(null);
    setTray((prev) => prev.filter((t) => t.id !== tile.id));
    setBuilt((prev) => [...prev, tile]);
  }, [checking, solved]);

  const removeTile = useCallback((tile: Tile) => {
    if (checking || solved) return;
    setMatches(null);
    setBuilt((prev) => prev.filter((t) => t.id !== tile.id));
    setTray((prev) => [...prev, tile]);
  }, [checking, solved]);

  const reset = useCallback(() => {
    setTray(shuffle([...tray, ...built]));
    setBuilt([]);
    setMatches(null);
  }, [tray, built]);

  const handleCheck = useCallback(async () => {
    if (tray.length > 0 || built.length === 0) return;
    setChecking(true);
    const builtText = built.map((t) => t.label).join(" ");

    const result = await checkGrammar(builtText, language);
    const foundMatches = result.ok && result.supported ? result.matches : positionalMismatch(builtText, sentence);

    setChecking(false);

    if (foundMatches.length === 0) {
      setSolved(true);
      confetti({
        particleCount: 60,
        spread: 65,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#fbbf24", "#fcd34d", "#34d399"],
      });
      window.setTimeout(() => onComplete({ correct: true, xpEarned: 20 }), 1400);
    } else {
      setMatches(foundMatches);
    }
  }, [tray, built, language, sentence, onComplete]);

  const builtText = built.map((t) => t.label).join(" ");
  const segments = matches ? splitByMatches(builtText, matches) : null;

  return (
    <div className="pointer-events-auto relative mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0b1210]/95 p-6 backdrop-blur-xl sm:p-8">
      <div className="mb-6">
        <div className="inline-block px-3 py-1 bg-amber-500/20 rounded-lg mb-4">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Tile Builder</p>
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Build the sentence</h2>
        {translation && <p className="text-sm text-slate-400">{translation}</p>}
      </div>

      {/* The sentence being assembled */}
      <div className="mb-6 min-h-[4.5rem] rounded-xl border-2 border-dashed border-white/20 bg-white/5 p-4">
        {segments ? (
          <p className="text-xl font-semibold leading-relaxed text-white">
            {segments.map((seg, i) =>
              seg.underline ? (
                <span
                  key={i}
                  className="underline decoration-red-400 decoration-4 underline-offset-4 text-red-300"
                >
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
        ) : built.length === 0 ? (
          <p className="text-sm text-slate-500">Tap the tiles below, in order.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {built.map((tile) => (
              <WordBlock
                key={tile.id}
                label={tile.label}
                skin="slate"
                size="sm"
                onClick={() => removeTile(tile)}
              />
            ))}
          </div>
        )}
      </div>

      {matches && matches.length > 0 && (
        <p className="mb-4 text-sm text-red-300">{matches[0].shortMessage || matches[0].message}</p>
      )}

      {/* The tray */}
      {!solved && (
        <div className="border-t border-white/10 pt-5">
          <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white/35">
            Tap to add
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {tray.map((tile) => (
              <WordBlock key={tile.id} label={tile.label} skin="slate" onClick={() => addTile(tile)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {matches && matches.length > 0 ? (
          <Button
            onClick={reset}
            className="flex-1 gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold"
          >
            <RotateCcw className="w-4 h-4" /> Try again
          </Button>
        ) : (
          <Button
            onClick={handleCheck}
            disabled={tray.length > 0 || built.length === 0 || checking || solved}
            className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold hover:shadow-lg transition-all"
          >
            <span>{checking ? "Checking…" : "Check"}</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
        <Button
          onClick={onSkip}
          variant="outline"
          className="px-6 border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
