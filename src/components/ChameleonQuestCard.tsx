// Discover's hero: the learner's one Chameleon video and its word map.
// While it isn't fully green, the rest of Discover stays locked.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, RotateCcw, Trophy, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChameleonWordMap } from "@/components/ChameleonWordMap";
import { usePet } from "@/contexts/PetContext";
import {
  celebrateMastery,
  summarizeWordMap,
  useVideoWordMap,
  type ChameleonQuest,
} from "@/lib/chameleonQuest";

interface Props {
  userId: string | null;
  language: string;
  quest: ChameleonQuest | null;
  onComplete: () => boolean;
  onClear: () => void;
}

export function ChameleonQuestCard({ userId, language, quest, onComplete, onClear }: Props) {
  const navigate = useNavigate();
  const { triggerReaction } = usePet();
  const tiles = useVideoWordMap(userId, quest?.filmId ?? null, language);
  const summary = tiles ? summarizeWordMap(tiles) : null;

  useEffect(() => {
    if (summary?.mastered && quest && !quest.masteredAt && onComplete()) {
      celebrateMastery();
      triggerReaction("perfect");
    }
  }, [summary?.mastered, quest, onComplete, triggerReaction]);

  // No intro card when nothing is picked: the quest is offered in context
  // (Watch header, end-of-watch screen) instead of as Discover copy.
  if (!quest) return null;

  const mastered = !!quest.masteredAt || !!summary?.mastered;

  return (
    <section className="glass-panel-strong rounded-2xl p-5 sm:p-6 border border-emerald-500/25 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row gap-5">
        <button
          onClick={() => navigate(`/watch/${quest.filmId}`)}
          className="group relative shrink-0 w-full sm:w-64 aspect-video rounded-xl overflow-hidden bg-secondary border border-border"
        >
          {quest.thumbnailUrl && (
            <img src={quest.thumbnailUrl} alt={quest.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
              <Play className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest text-emerald-300 mb-1">Your Chameleon video</p>
          <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">{quest.title}</h2>

          {mastered ? (
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-amber-300 flex items-center gap-2">
                <Trophy className="w-6 h-6" /> Level up! Every word is green.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You adapted to this video like a chameleon. New videos are unlocked — pick your next one.
              </p>
            </div>
          ) : summary ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold text-foreground">
                {summary.total === 0 ? "Watch it once to build your word map" : `${summary.left} words left to turn green`}
              </span>
              {summary.total > 0 && (
                <span className="text-muted-foreground tabular-nums">
                  🟢 {summary.green + summary.gold} · 🟠 {summary.orange} · 🔴 {summary.red}
                </span>
              )}
            </div>
          ) : (
            <Loader2 className="w-4 h-4 mt-3 animate-spin text-muted-foreground" />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {mastered ? (
              <Button variant="hero" onClick={onClear} className="gap-1.5">
                <Trophy className="w-4 h-4" /> Pick my next video
              </Button>
            ) : (
              <>
                <Button variant="hero" onClick={() => navigate(`/watch/${quest.filmId}`)} className="gap-1.5">
                  <RotateCcw className="w-4 h-4" /> Rewatch
                </Button>
                <Button variant="outline" onClick={() => navigate("/flashcards")} className="gap-1.5">
                  <BookOpen className="w-4 h-4" /> Review my words
                </Button>
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    if (window.confirm("Switch to a different video? Your words stay saved, but this video's quest ends.")) onClear();
                  }}
                >
                  Switch video
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {tiles && tiles.length > 0 && (
        <ChameleonWordMap
          tiles={tiles}
          filmId={quest.filmId}
          className="relative mt-5 max-h-56 overflow-y-auto pr-1"
        />
      )}
    </section>
  );
}
