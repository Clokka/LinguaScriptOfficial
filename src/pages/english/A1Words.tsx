// /english/a1/words — A1 vocabulary (about 400–700 words; no official CEFR count).
// Step 1: the first 100, the most frequent. Listen, tick "I know it",
// save to LinguaScript flashcards.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useAuth } from "@/hooks/useAuth";
import { TOP_100 } from "@/lib/english/a1/words";
import { A1_WORD_RANGE, wordsKnown } from "@/lib/english/a1/progress";
import { saveA1Word } from "@/lib/english/a1/saveWord";
import { track } from "@/lib/analytics";
import { A1Nav, Bar, SpeakButton, useA1Progress } from "./A1Shared";

export default function A1Words() {
  const { user } = useAuth();
  const [p, update] = useA1Progress();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const known = wordsKnown(p);

  const toggle = (w: string) => update((prev) => {
    const has = prev.known.includes(w);
    const next = { ...prev, known: has ? prev.known.filter((x) => x !== w) : [...prev.known, w] };
    track("a1_words_known_updated", { known: wordsKnown(next) });
    return next;
  });

  const save = async (w: string, ex: string) => {
    setSaving(w);
    try {
      const { translation } = await saveA1Word(user, w, ex);
      setSaved((s) => new Set(s).add(w));
      toast.success(`🔴 Saved: ${w}${translation ? ` = ${translation}` : ""}`, user ? undefined : { description: "Sign up free to keep your flashcards on every device." });
    } catch {
      toast.error("Couldn't save that. Please try again.");
    } finally { setSaving(null); }
  };

  return (
    <>
      <Seo title="English A1 vocabulary: how many words you need, starting with the 100 most common"
        description="English A1 usually means about 400–700 words. Start with the 100 most frequent: they make up about half of everyday English. Meanings, examples, audio and flashcards."
        path="/english/a1/words" />
      <MarketingLayout eyebrow="English A1 · words" heading="A1 words: start with the 100 most common"
        intro={<>A1 learners usually know <strong className="text-foreground">about {A1_WORD_RANGE} words</strong>. There's no official number: the CEFR describes what you can <em>do</em>, not a word count, so courses and exams vary. The best place to start is these <strong className="text-foreground">100 most common words</strong>: they make up about half of everything you read and hear (<Link to="/frequent-words" className="text-primary hover:underline">why?</Link>). Tick the ones you know, and save the others to your flashcards.</>}
        cta={{ label: "Keep your flashcards free", to: "/auth?next=/english/a1/words" }}>
        <A1Nav />
        <div className="not-prose mb-6 space-y-2 rounded-2xl border border-border bg-card p-5">
          <p className="font-bold text-foreground">You know {known} of these first 100</p>
          <Bar pct={known} />
          <p className="text-xs text-muted-foreground">Step 1 of your A1 words (about {A1_WORD_RANGE} in total). Next: the rest, in 15 everyday topics (family, food, travel…). Saved on this device.</p>
        </div>
        <ol className="not-prose grid gap-2">
          {TOP_100.map((x, i) => {
            const isKnown = p.known.includes(x.w);
            return (
              <li key={x.w} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${isKnown ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
                <span className="w-7 text-right text-xs font-semibold text-muted-foreground">{i + 1}</span>
                <SpeakButton text={`${x.w}. ${x.ex}`} />
                <span className="min-w-0 flex-[1_1_220px]">
                  <span className="block font-bold text-foreground" translate="no">{x.w}</span>
                  <span className="block text-sm text-muted-foreground">{x.meaning} · <i translate="no">{x.ex}</i></span>
                </span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => toggle(x.w)} aria-pressed={isKnown}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${isKnown ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:border-primary"}`}>
                    <Check className="h-3.5 w-3.5" />{isKnown ? "Known" : "I know it"}
                  </button>
                  {!isKnown && (
                    <button type="button" onClick={() => void save(x.w, x.ex)} disabled={saving === x.w || saved.has(x.w)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-foreground hover:border-primary disabled:opacity-60">
                      <Plus className="h-3.5 w-3.5" />{saved.has(x.w) ? "Saved" : saving === x.w ? "Saving…" : "Flashcard"}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </MarketingLayout>
    </>
  );
}
