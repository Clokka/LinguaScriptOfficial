import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Sparkles, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  COMPREHENSION_LADDER,
  computeComprehension,
  loadProgression,
  loadUserVocab,
  saveSnapshot,
  tokenizeTranscript,
  wordsNeededForTarget,
  type ComprehensionResult,
  type ProgressionDelta,
} from "@/lib/comprehension";

interface Props {
  /** Pre-resolved YouTube videoId — used when embedded in /watch */
  videoId: string;
  /** Optional title for the snapshot label */
  title?: string;
  /** Compact = no header / chrome (for /watch sidebar). */
  compact?: boolean;
}

interface AnalyzeResponse {
  videoId: string;
  language: string;
  meta: { title?: string | null; channel?: string | null; durationSec?: number } | null;
  transcript: { text: string; segmentCount: number };
  error?: string;
}

export function ComprehensionPanel({ videoId, title, compact = false }: Props) {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComprehensionResult | null>(null);
  const [progression, setProgression] = useState<ProgressionDelta | null>(null);
  const [metaTitle, setMetaTitle] = useState<string | undefined>(title);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke<AnalyzeResponse>(
          "analyze-comprehension",
          { body: { videoId, language: learningLanguage } },
        );
        if (cancelled) return;
        if (invokeErr) throw new Error(invokeErr.message);
        if (!data || data.error) throw new Error(data?.error || "Analyze failed");
        if (!data.transcript?.text) {
          throw new Error(
            `No ${learningLanguage.toUpperCase()} transcript available for this video.`,
          );
        }

        const tokens = tokenizeTranscript(data.transcript.text);
        const vocab = await loadUserVocab(user?.id ?? null, learningLanguage);
        const computed = computeComprehension(tokens, vocab);
        if (cancelled) return;

        const finalTitle = title || data.meta?.title || undefined;
        setMetaTitle(finalTitle);
        setResult(computed);

        if (user?.id) {
          const prog = await loadProgression(user.id, videoId, computed.score);
          if (!cancelled) setProgression(prog);
          await saveSnapshot({
            userId: user.id,
            videoId,
            language: learningLanguage,
            title: finalTitle,
            result: computed,
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [videoId, learningLanguage, user?.id, title]);

  const ladderRows = useMemo(() => {
    if (!result) return [];
    return COMPREHENSION_LADDER.map((rung) => ({
      ...rung,
      ...wordsNeededForTarget(result, rung.target),
    }));
  }, [result]);

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Analyzing transcript…
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-sm">
        <p className="text-destructive font-medium">Couldn't analyze this video</p>
        <p className="text-muted-foreground mt-1">{error}</p>
      </Card>
    );
  }
  if (!result) return null;

  const { counts, score, totalWords, uniqueWords, green, orange, red } = result;
  const known = counts.green;
  const learning = counts.orange;
  const newWords = counts.red;

  return (
    <div className="space-y-4">
      {!compact && metaTitle && (
        <div>
          <h2 className="text-xl font-semibold">{metaTitle}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {totalWords.toLocaleString()} words · {uniqueWords.toLocaleString()} unique
          </p>
        </div>
      )}

      {/* Score card */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-5xl font-bold tracking-tight">{score.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground mt-1">understood</div>
          </div>
          {progression?.deltaThisWeek != null && progression.deltaThisWeek !== 0 && (
            <Badge
              variant="outline"
              className={
                progression.deltaThisWeek > 0
                  ? "text-emerald-500 border-emerald-500/40"
                  : "text-red-500 border-red-500/40"
              }
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {progression.deltaThisWeek > 0 ? "+" : ""}
              {progression.deltaThisWeek}% vs last
            </Badge>
          )}
        </div>
        <Progress value={score} className="mt-4 h-2" />
        <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
          <BreakdownStat color="emerald" label="Known" value={known} />
          <BreakdownStat color="amber" label="Learning" value={learning} />
          <BreakdownStat color="red" label="New" value={newWords} />
        </div>
      </Card>

      {/* Ladder */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Comprehension targets</h3>
        </div>
        <div className="space-y-2">
          {ladderRows.map((r) => {
            const hit = score >= r.target;
            return (
              <div
                key={r.target}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-lg font-bold ${
                      hit ? "text-emerald-500" : "text-muted-foreground"
                    }`}
                  >
                    {r.target}%
                  </span>
                  <div>
                    <div className="text-sm font-medium">{r.label}</div>
                    {!hit && r.wordsNeeded > 0 && (
                      <div className="text-xs text-muted-foreground">
                        +{r.wordsNeeded} green words needed
                      </div>
                    )}
                  </div>
                </div>
                {hit ? (
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-0">Reached</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    +{(r.target - score).toFixed(1)}%
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top missing words */}
      {red.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-red-500" />
              <h3 className="font-semibold text-sm">High-impact words to learn</h3>
            </div>
            <Link to="/flashcards" className="text-xs text-primary hover:underline">
              Open flashcards →
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {red.slice(0, 30).map((w) => (
              <span
                key={w.word}
                className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs border border-red-500/20"
                title={`Appears ${w.count}×`}
              >
                {w.word}
                <span className="opacity-60 ml-1">×{w.count}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Other buckets, compact */}
      {(orange.length > 0 || green.length > 0) && (
        <Card className="p-5 grid sm:grid-cols-2 gap-4">
          <BucketList title="🟠 Learning" color="amber" words={orange.slice(0, 20)} />
          <BucketList title="🟢 Mastered" color="emerald" words={green.slice(0, 20)} />
        </Card>
      )}
    </div>
  );
}

function BreakdownStat({
  color,
  label,
  value,
}: {
  color: "emerald" | "amber" | "red";
  label: string;
  value: number;
}) {
  const map = {
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    red: "text-red-500",
  } as const;
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className={`text-xl font-bold ${map[color]}`}>{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function BucketList({
  title,
  color,
  words,
}: {
  title: string;
  color: "amber" | "emerald";
  words: { word: string; count: number }[];
}) {
  if (words.length === 0) return null;
  const cls =
    color === "amber"
      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  return (
    <div>
      <h4 className="text-xs font-semibold mb-2 text-muted-foreground">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => (
          <span key={w.word} className={`px-2 py-1 rounded-md text-xs border ${cls}`}>
            {w.word}
            <span className="opacity-60 ml-1">×{w.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
