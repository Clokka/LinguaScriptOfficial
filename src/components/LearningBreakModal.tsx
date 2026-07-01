import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X as XIcon, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useXp } from "@/contexts/XpContext";
import { usePet } from "@/contexts/PetContext";
import { playDing } from "@/lib/sound";

export interface QuizWord {
  word: string;
  translation: string;
}

interface Question {
  prompt: string; // translation shown
  correct: string; // word
  options: string[]; // shuffled words
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function buildQuestions(words: QuizWord[]): Question[] {
  const valid = words.filter((w) => w.word && w.translation);
  if (valid.length < 2) return [];
  const picks = shuffle(valid).slice(0, Math.min(3, valid.length));
  return picks.map((p) => {
    const distractors = shuffle(valid.filter((w) => w.word !== p.word))
      .slice(0, 3)
      .map((w) => w.word);
    return {
      prompt: p.translation,
      correct: p.word,
      options: shuffle([p.word, ...distractors]),
    };
  });
}

interface Props {
  open: boolean;
  words: QuizWord[];
  onClose: () => void;
  onResume: () => void;
}

export function LearningBreakModal({ open, words, onClose, onResume }: Props) {
  const { award } = useXp();
  const { triggerReaction } = usePet();
  const questions = useMemo(() => buildQuestions(words), [words, open]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [done, setDone] = useState(false);

  if (!questions.length) return null;
  const q = questions[idx];

  const pick = (option: string) => {
    if (picked) return;
    setPicked(option);
    if (option === q.correct) {
      const gained = award("review_card", { correct: true });
      setScore((s) => s + 1);
      setXpEarned((x) => x + gained);
      playDing("success");
    }
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        setDone(true);
        triggerReaction("celebrate");
      } else {
        setIdx((i) => i + 1);
        setPicked(null);
      }
    }, 900);
  };

  const handleResume = () => {
    onResume();
    // reset for next break
    setTimeout(() => {
      setIdx(0);
      setPicked(null);
      setScore(0);
      setXpEarned(0);
      setDone(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl border-[hsl(250_30%_30%/0.3)] bg-[hsl(230_25%_10%/0.95)] backdrop-blur-2xl">
        {!done ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary/80">
                <Sparkles className="h-3.5 w-3.5" />
                Learning break · {idx + 1} / {questions.length}
              </div>
              <DialogTitle className="text-lg font-medium text-foreground">
                Which word means "{q.prompt}"?
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-2 pt-2">
              {q.options.map((opt) => {
                const isCorrect = picked && opt === q.correct;
                const isWrong = picked === opt && opt !== q.correct;
                return (
                  <button
                    key={opt}
                    onClick={() => pick(opt)}
                    disabled={!!picked}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                      "border-[hsl(250_30%_30%/0.3)] bg-[hsl(230_25%_14%/0.6)] hover:bg-[hsl(230_25%_18%/0.8)]",
                      isCorrect && "border-success/60 bg-success/10 text-success",
                      isWrong && "border-destructive/60 bg-destructive/10 text-destructive",
                    )}
                  >
                    <span className="text-base">{opt}</span>
                    {isCorrect && <Check className="h-4 w-4" />}
                    {isWrong && <XIcon className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
                <Trophy className="h-3.5 w-3.5" />
                Break complete
              </div>
              <DialogTitle className="text-2xl font-semibold">
                {score} / {questions.length} correct
              </DialogTitle>
            </DialogHeader>
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
              <div className="text-xs uppercase tracking-widest text-primary/80">XP earned</div>
              <div className="text-3xl font-semibold text-primary">+{xpEarned}</div>
            </div>
            <Button variant="hero" size="lg" onClick={handleResume} className="mt-2 w-full">
              Keep watching
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
