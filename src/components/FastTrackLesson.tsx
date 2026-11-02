import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Lightbulb, Volume2, X, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playDing } from "@/lib/sound";
import { lessonPlan, sentenceFor, type FtLesson, type FtPrompt, type FtWord } from "@/lib/cognates/fastTrack";
import { looseFr, tidyFr } from "@/lib/cognates/french";

/**
 * One Fast Track lesson: a pattern card, then ~12 substitution drills.
 * The last right sentence is already in the box — change ONE thing:
 *   🔁 a new word  (Je suis calme. → patient → Je suis patient.)
 *   🔁 a new frame (Je suis patient. → "Are you…?" → Tu es patient ?)
 * Wrong answers come back at the end of the lesson.
 */

const ACCENTS = ["é", "è", "ê", "à", "ç", "ô", "û", "î"];

function speakFr(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* no speech on this device */ }
}

type Feedback = { ok: boolean; almost: boolean; answer: string; en: string } | null;

export function FastTrackLesson({ lesson, words, number, onDone, onExit }: {
  lesson: FtLesson; words: FtWord[]; number: number; onDone: (words: FtWord[]) => void; onExit: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<FtPrompt[]>(() => lessonPlan(words.length));
  const total = useMemo(() => lessonPlan(words.length).length, [words.length]);
  const [doneCount, setDoneCount] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showTip, setShowTip] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const lastRight = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [turn, setTurn] = useState(0);

  const p = queue[0];

  useEffect(() => {
    if (!started || !p) return;
    // Substitution: the last right sentence is already typed — change one thing.
    setInput(p.cue === "first" || p.cue === "again" ? "" : lastRight.current);
    setShowTip(false);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [started, turn, p]);

  const finished = started && !p;
  useEffect(() => { if (finished) { playDing("success"); onDone(words); } }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const [f0, f1] = lesson.frames;
  const examples = words.slice(0, 2).map((w) => sentenceFor(f0, w).text).concat(sentenceFor(f1, words[0]).text);

  if (!started) {
    return (
      <section className="space-y-4">
        <button type="button" onClick={onExit} className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Lessons</button>
        <div className="rounded-2xl border border-border p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#34C759]">Lesson {number}</div>
          <h2 className="text-2xl font-bold">{lesson.title}</h2>
          <div className="grid gap-2" translate="no">
            {[f0, f1].map((f) => (
              <div key={f.fr} className="rounded-xl bg-muted p-3">
                <div className="font-semibold text-lg">{f.fr.replace("___", "…").replace("….", "…")}</div>
                <div className="text-sm text-muted-foreground" translate="yes">{f.en.replace("___", "…").replace("….", "…")}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1" translate="no">
            {examples.map((s) => (
              <button key={s} type="button" onClick={() => speakFr(s)} className="w-full flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted text-left">
                <span>{s}</span><Volume2 className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" translate="no">
            {words.map((w) => (
              <span key={w.fr} className="rounded-full border border-border px-3 py-1 text-sm">{w.fr} <span className="text-muted-foreground" translate="yes">· {w.en}</span></span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Keep the sentence, swap one thing at a time. About 2 minutes.</p>
        </div>
        <Button className="w-full h-12 text-base" onClick={() => { setStarted(true); speakFr(examples[0]); }}>Start →</Button>
      </section>
    );
  }

  if (finished) {
    return (
      <section className="text-center space-y-4 py-8">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold">Lesson {number} done!</h2>
        <p className="text-muted-foreground">+{words.length} words · you used <b translate="no">{f0.fr.replace("___", "…").replace("….", "…")}</b> {total} times{mistakes ? ` · ${mistakes} to practise again` : " · no mistakes!"}</p>
        <Button className="h-12 px-8" onClick={onExit}>Next lesson →</Button>
      </section>
    );
  }

  const w = words[p.word];
  const frame = lesson.frames[p.frame];
  const { text, accept } = sentenceFor(frame, w);
  const en = frame.en.replace("___", w.en);

  const check = () => {
    if (feedback) return next();
    const given = input.trim();
    if (!given) return;
    const exact = accept.some((a) => tidyFr(a) === tidyFr(given));
    const almost = !exact && accept.some((a) => looseFr(a) === looseFr(given));
    const ok = exact || almost;
    setFeedback({ ok, almost, answer: text, en });
    speakFr(text);
    if (ok) playDing(exact ? "success" : "soft");
    else setMistakes((m) => m + 1);
  };

  const next = () => {
    const ok = !!feedback?.ok;
    setFeedback(null);
    lastRight.current = text;
    if (ok) setDoneCount((d) => d + 1);
    setQueue(([head, ...rest]) => (ok ? rest : [...rest, { ...head, cue: "again" as const }]));
    setTurn((t) => t + 1);
  };

  const addAccent = (a: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? input.length, end = el?.selectionEnd ?? input.length;
    setInput(input.slice(0, start) + a + input.slice(end));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(start + 1, start + 1); }, 0);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={onExit} aria-label="Back to lessons" className="text-muted-foreground"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-[#34C759] transition-all" style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
        <span className="text-muted-foreground tabular-nums">{doneCount}/{total}</span>
      </div>

      <div className="rounded-2xl border border-border p-5 space-y-4">
        {p.cue === "first" || p.cue === "again" ? (
          <div>
            <div className="text-sm text-muted-foreground">{p.cue === "again" ? "Once more — listen and type it" : "Listen and type it"}</div>
            <button type="button" onClick={() => speakFr(text)} className="mt-1 flex items-center gap-2 text-2xl font-semibold" translate="no">
              {text} <Volume2 className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="text-sm text-muted-foreground mt-1">{en}</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#34C759] flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5" /> {p.cue === "frame" ? "Swap the sentence" : "Swap the word"}
            </div>
            {p.cue === "word" ? (
              <div className="text-3xl font-bold">{w.en}</div>
            ) : (
              <div className="text-2xl font-bold">{frame.en.replace("___", "…").replace("….", "…")}</div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); check(); } }}
          readOnly={!!feedback}
          autoCapitalize="sentences" autoCorrect="off" autoComplete="off" spellCheck={false}
          lang="fr" translate="no"
          placeholder="type the French sentence"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg focus:outline-none focus:border-[#34C759]"
        />

        {!feedback && (
          <div className="flex flex-wrap gap-1.5">
            {ACCENTS.map((a) => (
              <button key={a} type="button" onClick={() => addAccent(a)} className="w-9 h-9 rounded-lg bg-muted font-semibold">{a}</button>
            ))}
            {p.cue !== "first" && p.cue !== "again" && (
              <button type="button" onClick={() => setShowTip((v) => !v)} className="ml-auto h-9 px-3 rounded-lg bg-muted text-sm flex items-center gap-1">
                <Lightbulb className="w-4 h-4" /> Hint
              </button>
            )}
          </div>
        )}
        {showTip && !feedback && (
          <p className="text-sm text-muted-foreground">
            {p.cue === "word" ? <><b translate="no">{w.fr}</b>{w.tip ? ` — ${w.tip}` : ""}</> : <span translate="no"><b>{frame.fr.replace("___", "…").replace("….", "…")}</b></span>}
          </p>
        )}

        {feedback && (
          <div className={`rounded-xl p-3 text-sm ${feedback.ok ? "bg-[#34C759]/15" : "bg-[#FF3B30]/15"}`}>
            <div className="flex items-center gap-2 font-semibold">
              {feedback.ok ? <Check className="w-4 h-4 text-[#34C759]" /> : <X className="w-4 h-4 text-[#FF3B30]" />}
              {feedback.ok ? (feedback.almost ? "Almost — watch the accents!" : "Correct!") : "Not quite — it's:"}
              <button type="button" onClick={() => speakFr(feedback.answer)} className="ml-auto" aria-label="Listen"><Volume2 className="w-4 h-4" /></button>
            </div>
            <div className="mt-1 text-base" translate="no">{feedback.answer}</div>
            <div className="text-muted-foreground">{feedback.en}</div>
          </div>
        )}

        <Button className="w-full h-11" onClick={check}>{feedback ? "Next →" : "Check"}</Button>
      </div>
    </section>
  );
}
