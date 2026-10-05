// Polished post-watch results screen. Shows the new comprehension score,
// the improvement since the previous watch, a per-watch timeline, and the
// vocabulary breakdown — turning "I just watched a video" into a measurable
// win every time.
import { useEffect, useMemo, useState } from "react";
import { Sparkles, TrendingUp, Target, Trophy, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchFilmSessions, type WatchSession, type RecordResult } from "@/lib/watchSessions";
import type { VideoComprehension } from "@/lib/videoComprehension";
import { usePet } from "@/contexts/PetContext";
import { ChameleonWordMap } from "@/components/ChameleonWordMap";
import { celebrateMastery, summarizeWordMap, useVideoWordMap } from "@/lib/chameleonQuest";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  filmId: string;
  /** Deck language the video's words are scored in. */
  language: string;
  /** This is the learner's Chameleon video — the word map is the headline. */
  isQuestVideo: boolean;
  /** Marks the Chameleon video mastered; true only the first time. */
  onMastered: () => boolean;
  /** Offered when the learner has no Chameleon video in progress. */
  onStartQuest?: () => void;
  result: RecordResult | null;
  comprehension: VideoComprehension;
  durationMinutes: number;
  onClose: () => void;
  onReview: () => void;
}

export function WatchResultsModal({
  open, filmId, language, isQuestVideo, onMastered, onStartQuest, result, comprehension, durationMinutes, onClose, onReview,
}: Props) {
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const { triggerReaction } = usePet();
  const { user } = useAuth();
  const [questStarted, setQuestStarted] = useState(false);
  const tiles = useVideoWordMap(open ? user?.id ?? null : null, open ? filmId : null, language, result?.watch_number ?? 0);
  const words = tiles ? summarizeWordMap(tiles) : null;

  useEffect(() => {
    if (open && isQuestVideo && words?.mastered && onMastered()) {
      celebrateMastery();
      triggerReaction("perfect");
    }
  }, [open, isQuestVideo, words?.mastered, onMastered, triggerReaction]);

  useEffect(() => {
    if (!open) return;
    fetchFilmSessions(filmId).then(setSessions);
    const score = result?.new_pct ?? comprehension.pct;
    if (score >= 100) {
      triggerReaction("perfect"); // 9s chained celebration
    } else {
      triggerReaction("celebrate", 4000);
    }
  }, [open, filmId, result?.watch_number, triggerReaction]);

  const latest = result?.new_pct ?? comprehension.pct;
  const prev = result?.prev_pct ?? null;
  const delta = result?.delta ?? 0;
  const watchN = result?.watch_number ?? 1;
  const isFirst = prev === null;
  const xp = isFirst ? 10 : 5 + Math.max(0, Math.round(delta));
  const mastery = Math.min(100, Math.round((result?.best_pct ?? latest)));

  const timeline = useMemo(() => {
    if (sessions.length === 0) {
      return [{ n: 1, pct: latest }];
    }
    return sessions.map((s) => ({ n: s.watch_number, pct: Math.round(s.comprehension_pct) }));
  }, [sessions, latest]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-panel-strong rounded-3xl p-6 sm:p-7 animate-bounce-in shadow-float overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Halo glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-300 mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Watch #{watchN} · +{xp} XP</span>
        </div>
        <h3 className="relative text-xl sm:text-2xl font-bold text-foreground mb-4">
          {isQuestVideo
            ? words?.mastered
              ? "🏆 Level up! The whole video is green."
              : isFirst ? "🦎 Your Chameleon video's colours" : "🦎 Watch the chameleon adapt"
            : isFirst ? "Your starting comprehension" : "You understand more now"}
        </h3>

        {/* Word map — every word in the video, flipping to its new colour. */}
        {tiles && tiles.length > 0 && (
          <div className="relative mb-4">
            <ChameleonWordMap tiles={tiles} filmId={filmId} className="max-h-40 overflow-y-auto pr-1" />
            {words && (
              <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                {words.mastered
                  ? "Every word is green. New videos are unlocked!"
                  : `${words.left} words left to turn green · 🟢 ${words.green + words.gold} · 🟠 ${words.orange} · 🔴 ${words.red}`}
              </p>
            )}
          </div>
        )}

        {onStartQuest && !isQuestVideo && (
          <div className="relative mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            {questStarted ? (
              <p className="text-emerald-300 font-semibold">🦎 Locked in! Rewatch this video until every word is green.</p>
            ) : (
              <div className="flex items-center gap-3">
                <p className="flex-1 text-muted-foreground">
                  Like this one? Make it your Chameleon video and rewatch it until it's all green.
                </p>
                <Button size="sm" variant="hero" onClick={() => { onStartQuest(); setQuestStarted(true); }}>
                  🦎 Make it mine
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Big number — the word map above already tells the Chameleon story. */}
        {!isQuestVideo && (
        <div className="relative flex items-baseline gap-3 mb-4 tabular-nums">
          {!isFirst && prev !== null && (
            <>
              <span className="text-2xl text-muted-foreground/80">{Math.round(prev)}%</span>
              <span className="text-muted-foreground/60">→</span>
            </>
          )}
          <span className="text-5xl sm:text-6xl font-bold text-emerald-400 drop-shadow-[0_0_24px_rgba(52,211,153,0.35)]">
            {Math.round(latest)}%
          </span>
          {delta > 0 && (
            <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
              +{Math.round(delta)}%
            </span>
          )}
        </div>
        )}

        {/* Timeline */}
        {!isQuestVideo && timeline.length > 0 && (
          <div className="relative mb-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Your comprehension over time
            </p>
            <div className="space-y-1.5">
              {timeline.map((t) => {
                const isCurrent = t.n === watchN;
                return (
                  <div key={t.n} className="flex items-center gap-2 text-xs tabular-nums">
                    <span className={cn("w-12 shrink-0", isCurrent ? "text-emerald-300 font-semibold" : "text-muted-foreground")}>
                      Watch #{t.n}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-700 ease-out",
                          isCurrent
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                            : "bg-emerald-500/40"
                        )}
                        style={{ width: `${t.pct}%` }}
                      />
                    </div>
                    <span className={cn("w-10 text-right", isCurrent ? "text-emerald-300 font-semibold" : "text-muted-foreground")}>
                      {t.pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vocab grid */}
        <div className="relative grid grid-cols-3 gap-2 mb-4">
          <Stat label="Known" value={comprehension.greenCount} accent="emerald" />
          <Stat label="Saved" value={comprehension.orangeCount} accent="amber" />
          <Stat label="Unknown" value={comprehension.redCount} accent="rose" />
        </div>

        {/* Mastery */}
        <div className="relative grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-5">
          <MiniStat icon={Trophy} label="Mastery" value={`${mastery}%`} />
          <MiniStat icon={Target} label="Time" value={`${Math.max(1, Math.round(durationMinutes))}m`} />
          <MiniStat icon={BookOpen} label="Tokens" value={comprehension.totalTokens.toLocaleString()} />
        </div>

        {comprehension.potentialPct > latest && (
          <p className="relative text-xs text-muted-foreground bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 mb-4">
            Turn your saved words green and this video jumps to{" "}
            <span className="text-emerald-300 font-semibold">{comprehension.potentialPct}%</span> understanding.
          </p>
        )}

        <div className="relative flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Later</Button>
          <Button variant="hero" className="flex-1" onClick={onReview}>Review now</Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: "emerald" | "amber" | "rose" }) {
  const cls = {
    emerald: "text-emerald-400",
    amber: "text-amber-300",
    rose: "text-rose-300",
  }[accent];
  return (
    <div className="glass-panel p-3 rounded-xl text-center">
      <p className={cn("text-xl font-bold tabular-nums", cls)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <Icon className="w-3 h-3 text-muted-foreground/70" />
      <span className="text-foreground/80 normal-case tracking-normal font-medium">{value}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
