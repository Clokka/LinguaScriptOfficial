import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2 } from "lucide-react";
import { STATE_META, type DeckState } from "@/lib/vocab";
import { fetchTatoebaSentences, type TatoebaSentence } from "@/lib/tatoeba";
import { cn } from "@/lib/utils";

interface WordDetailModalProps {
  open: boolean;
  onClose: () => void;
  word: string;
  translation: string;
  language: string;
  state: DeckState;
  speak: (text: string, lang?: string) => void;
}

export function WordDetailModal({
  open,
  onClose,
  word,
  translation,
  language,
  state,
  speak,
}: WordDetailModalProps) {
  const [sentences, setSentences] = useState<TatoebaSentence[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !word) return;
    let alive = true;
    setLoading(true);
    setSentences([]);
    fetchTatoebaSentences(word, language).then((result) => {
      if (alive) {
        setSentences(result);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [open, word, language]);

  const meta = STATE_META[state];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-full", meta.dot)} />
            <DialogTitle className="text-2xl font-bold">{word}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              onClick={() => speak(word, language)}
              title="Pronounce"
            >
              <Volume2 className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <p className="text-muted-foreground">{translation}</p>

        <div className="mt-2 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold mb-3">
            3 more sentences
          </p>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Finding more examples…
            </div>
          )}

          {!loading && sentences.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No extra examples found for this word yet.
            </p>
          )}

          {!loading && sentences.length > 0 && (
            <ul className="space-y-3">
              {sentences.map((s, i) => (
                <li key={i} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <p className="text-foreground">{s.sentence}</p>
                  {s.translation && (
                    <p className="text-sm text-muted-foreground mt-1">{s.translation}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
