import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Lightbulb, ArrowLeft, Check, X } from "lucide-react";
import { PillarsNav } from "@/components/PillarsNav";
import { FastTrackLesson } from "@/components/FastTrackLesson";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FAST_TRACK, lessonWords, type FtLesson, type FtWord } from "@/lib/cognates/fastTrack";
import { interestById } from "@/lib/interests";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { playDing } from "@/lib/sound";
import {
  FRENCH_RULES, frenchCognates, framesFor, looseFr, tidyFr,
  type Cognate, type CognateRule,
} from "@/lib/cognates/french";

/**
 * /french-words — 1,000+ French words from a few ending rules (English and
 * French share Latin): nation → nation, liberty → liberté, rapidly → rapidement.
 * Each rule: a rule card, then three drills per word:
 *   1. Change it     — English word → type the French word
 *   2. Gap fill      — French sentence with a gap, English word as the clue
 *   3. Substitution  — the last sentence is already typed; swap in the new word
 * Three right answers = learned. Progress lives on this device (localStorage).
 * Words come from src/lib/cognates/french.ts (checked by scripts/check-cognates.ts).
 */

const STORE = "ls.cognates.fr";
const BATCH = 8;
const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "î", "ï", "ô", "û", "ù", "ë"];

type Saved = { learned: Record<string, number>; day: string; today: number; lessons?: Record<string, number> };
const todayKey = () => new Date().toISOString().slice(0, 10);

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "") as Saved;
    if (s && s.learned) return s.day === todayKey() ? s : { ...s, day: todayKey(), today: 0 };
  } catch { /* first visit or storage blocked */ }
  return { learned: {}, day: todayKey(), today: 0 };
}
function save(s: Saved) {
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* ignore */ }
}

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* no speech on this device */ }
}

type Stage = 0 | 1 | 2;
type Card = { word: Cognate; stage: Stage; frame: string; prev?: Cognate };
type Feedback = { ok: boolean; almost?: boolean; answer: string } | null;

const STAGE_NAME = ["Change it", "Fill the gap", "Swap the word"];

export default function FrenchWords() {
  const all = useMemo(() => frenchCognates(), []);
  const [saved, setSaved] = useState<Saved>(load);
  const [rule, setRule] = useState<CognateRule | null>(null);
  const [studying, setStudying] = useState(false);

  const learnedCount = Object.keys(saved.learned).length;
  const [lesson, setLesson] = useState<FtLesson | null>(null);
  const [showBank, setShowBank] = useState(false);
  const hobby = useHobby();
  const lessonsDone = saved.lessons || {};
  const nextLesson = FAST_TRACK.find((l) => !lessonsDone[l.id]) || FAST_TRACK[0];
  const finishLesson = (l: FtLesson, ws: FtWord[]) => {
    setSaved((s) => {
      const learned = { ...s.learned };
      let added = 0;
      for (const w of ws) if (!learned[w.fr]) { learned[w.fr] = Date.now(); added++; }
      const next = { ...s, learned, today: s.today + added, day: todayKey(), lessons: { ...(s.lessons || {}), [l.id]: Date.now() } };
      save(next);
      return next;
    });
  };
  const markLearned = (w: Cognate) => {
    setSaved((s) => {
      if (s.learned[w.fr]) return s;
      const next = { ...s, learned: { ...s.learned, [w.fr]: Date.now() }, today: s.today + 1, day: todayKey() };
      save(next);
      return next;
    });
  };

  const ruleWords = (r: CognateRule) => all.filter((w) => w.rule === r.id);
  const nextRule = FRENCH_RULES.find((r) => ruleWords(r).some((w) => !saved.learned[w.fr])) || FRENCH_RULES[0];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo
        title="French Fast Track · LinguaScript"
        description="Short French lessons: one everyday sentence pattern, six words that look like English, quick substitution drills. Plus 1,500 look-alike words by rule."
        path="/french-words"
      />
      <PillarsNav />
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {!lesson && <header className="space-y-3">
          <h1 className="text-2xl font-bold">🇬🇧 → 🇫🇷 French Fast Track</h1>
          <p className="text-muted-foreground text-sm">
            Short lessons, one everyday sentence at a time. Keep the sentence, swap one word —{" "}
            <b translate="no">Je suis calme → Je suis patient → Tu es patient ?</b> The words look like English,
            so they come almost free.
          </p>
          <div className="rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between text-sm font-semibold">
              <span>Lessons</span>
              <span><span className="text-[#34C759]">{FAST_TRACK.filter((l) => lessonsDone[l.id]).length}</span> / {FAST_TRACK.length}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-[#34C759] transition-all" style={{ width: `${(FAST_TRACK.filter((l) => lessonsDone[l.id]).length / FAST_TRACK.length) * 100}%` }} />
            </div>
            <div className="text-xs text-muted-foreground">{learnedCount.toLocaleString()} French words learned · {saved.today} today</div>
          </div>
        </header>}

        {lesson ? (
          <FastTrackLesson
            key={lesson.id}
            lesson={lesson}
            words={lessonWords(lesson, hobby)}
            number={FAST_TRACK.indexOf(lesson) + 1}
            onDone={(ws) => finishLesson(lesson, ws)}
            onExit={() => setLesson(null)}
          />
        ) : !showBank ? (
          <section className="space-y-2">
            <Button className="w-full h-12 text-base" onClick={() => setLesson(nextLesson)}>
              ▶ {lessonsDone[nextLesson.id] ? "Practise" : "Start"} lesson {FAST_TRACK.indexOf(nextLesson) + 1}: {nextLesson.title}
            </Button>
            {FAST_TRACK.map((l, i) => {
              const done = !!lessonsDone[l.id];
              const ws = lessonWords(l, hobby);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLesson(l)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors hover:border-[#34C759] ${l === nextLesson ? "border-[#34C759]" : "border-border"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{i + 1}. {l.title}{l.hobby && hobby ? ` · ${interestById(hobby)?.emoji ?? ""}` : ""}</span>
                    <span className="text-sm">{done ? "✅" : ""}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1" translate="no">
                    {ws.slice(0, 3).map((w) => l.frames[0].fr.replace("___", w.fr)).join(" · ")}
                  </div>
                </button>
              );
            })}
            <button type="button" onClick={() => setShowBank(true)} className="w-full mt-4 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground hover:text-foreground">
              📚 Extra practice: all {all.length.toLocaleString()} look-alike words, by rule
            </button>
          </section>
        ) : rule && studying ? (
          <Drill
            key={rule.id}
            rule={rule}
            words={ruleWords(rule).filter((w) => !saved.learned[w.fr])}
            onLearned={markLearned}
            onExit={() => setStudying(false)}
          />
        ) : rule ? (
          <RuleCard
            rule={rule}
            words={ruleWords(rule)}
            learned={saved.learned}
            onStart={() => setStudying(true)}
            onBack={() => setRule(null)}
          />
        ) : (
          <section className="space-y-2">
            <button type="button" onClick={() => setShowBank(false)} className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Fast Track lessons</button>
            <Button className="w-full h-12 text-base" onClick={() => setRule(nextRule)}>
              ▶ Continue: {nextRule.title}
            </Button>
            <h2 className="pt-4 font-semibold">The rules, easiest first</h2>
            {FRENCH_RULES.map((r, i) => {
              const ws = ruleWords(r);
              const done = ws.filter((w) => saved.learned[w.fr]).length;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRule(r)}
                  className="w-full text-left rounded-xl border border-border p-3 hover:border-[#34C759] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{i + 1}. {r.title}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{done} / {ws.length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1" translate="no">
                    {ws.slice(0, 3).map((w) => `${w.en} → ${w.fr}`).join(" · ")}
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden mt-2">
                    <div className="h-full bg-[#34C759]" style={{ width: `${(done / ws.length) * 100}%` }} />
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function RuleCard({ rule, words, learned, onStart, onBack }: {
  rule: CognateRule; words: Cognate[]; learned: Record<string, number>; onStart: () => void; onBack: () => void;
}) {
  const left = words.filter((w) => !learned[w.fr]).length;
  return (
    <section className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> All rules</button>
      <div className="rounded-2xl border border-border p-5 space-y-3">
        <h2 className="text-xl font-bold">{rule.title}</h2>
        <p className="text-sm">{rule.tip}</p>
        <div className="grid grid-cols-2 gap-2" translate="no">
          {words.slice(0, 8).map((w) => (
            <button
              key={w.fr}
              type="button"
              onClick={() => speak(w.fr)}
              className="rounded-lg bg-muted px-3 py-2 text-left text-sm flex items-center justify-between gap-2"
            >
              <span><span className="text-muted-foreground">{w.en}</span> → <b>{w.fr}</b></span>
              <Volume2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
      {left > 0 ? (
        <Button className="w-full h-12 text-base" onClick={onStart}>Drill {left} words →</Button>
      ) : (
        <p className="text-center font-semibold text-[#34C759]">✓ You've learned every word in this rule!</p>
      )}
    </section>
  );
}

/** The hobby picked in onboarding: profile for signed-in learners, device copy for guests. */
function useHobby(): string | null {
  const { user } = useAuth();
  const [hobby, setHobby] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem("ls.guestOnboarded.v1") || "{}")?.interests?.[0] ?? null; } catch { return null; }
  });
  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase.from("profiles").select("interests").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      const first = (data as { interests?: string[] } | null)?.interests?.[0];
      if (alive && first) setHobby(first);
    });
    return () => { alive = false; };
  }, [user]);
  return hobby;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function Drill({ rule, words, onLearned, onExit }: {
  rule: CognateRule; words: Cognate[]; onLearned: (w: Cognate) => void; onExit: () => void;
}) {
  // Words come in batches of 8; each card moves 0 → 1 → 2 → learned.
  const pool = useRef(words.slice());
  const [queue, setQueue] = useState<Card[]>(() => pool.current.splice(0, BATCH).map((w) => ({ word: w, stage: 0, frame: pick(framesFor(w)) })));
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showTip, setShowTip] = useState(false);
  const [streak, setStreak] = useState(0);
  const [turn, setTurn] = useState(0);
  const [model, setModel] = useState<{ text: string; frame: string; word: Cognate } | null>(null);
  const lastSentence = useRef<{ text: string; frame: string; word: Cognate } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const card = queue[0];

  // Substitution needs a sentence already said with another word of the same kind.
  useEffect(() => {
    if (!card) return;
    const last = lastSentence.current;
    const m = card.stage === 2 && last && last.word.fr !== card.word.fr && last.word.pos === card.word.pos && last.word.gender === card.word.gender ? last : null;
    setModel(m);
    setInput(m ? m.text : "");
    setShowTip(false);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [card, turn]);

  if (!card) {
    return (
      <section className="text-center space-y-4 py-10">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold">{rule.title} — done!</h2>
        <p className="text-muted-foreground">Every word in this rule is learned.</p>
        <Button onClick={onExit}>Back to the rules</Button>
      </section>
    );
  }

  const subModel = card.stage === 2 ? model : null;
  // Substitution keeps the model sentence and swaps only the word.
  const sentence = subModel ? subModel.frame.replace("___", card.word.fr) : card.frame.replace("___", card.word.fr);
  const target = card.stage === 0 ? card.word.fr : sentence;

  const check = () => {
    if (feedback) return next();
    const given = input.trim();
    if (!given) return;
    // Gap fill: they may type only the missing word, or the whole sentence.
    const asTyped = card.stage === 1 && !given.includes(" ") ? card.frame.replace("___", given) : given;
    const exact = tidyFr(asTyped) === tidyFr(target);
    const almost = !exact && looseFr(asTyped) === looseFr(target);
    const ok = exact || almost;
    setFeedback({ ok, almost, answer: target });
    speak(card.stage === 0 ? card.word.fr : sentence);
    if (ok) { playDing(exact ? "success" : "soft"); setStreak((s) => s + 1); } else setStreak(0);
  };

  const next = () => {
    const fb = feedback;
    setFeedback(null);
    setTurn((t) => t + 1);
    if (card.stage >= 1) lastSentence.current = { text: sentence, frame: subModel ? subModel.frame : card.frame, word: card.word };
    setQueue((q) => {
      const [head, ...rest] = q;
      let after = rest;
      if (fb?.ok) {
        if (head.stage === 2) {
          onLearned(head.word);
          const fresh = pool.current.shift();
          if (fresh) after = [...after, { word: fresh, stage: 0, frame: pick(framesFor(fresh)) }];
        } else {
          // Come back to it a few cards later, one step harder.
          const moved: Card = { ...head, stage: (head.stage + 1) as Stage, frame: pick(framesFor(head.word)) };
          after = [...after.slice(0, 3), moved, ...after.slice(3)];
        }
      } else {
        after = [...after.slice(0, 2), head, ...after.slice(2)];
      }
      return after;
    });
  };

  const addAccent = (a: string) => {
    const el = inputRef.current;
    if (!el) return setInput((v) => v + a);
    const start = el.selectionStart ?? input.length, end = el.selectionEnd ?? input.length;
    const v = input.slice(0, start) + a + input.slice(end);
    setInput(v);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + 1, start + 1); }, 0);
  };

  const left = queue.length + pool.current.length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onExit} className="text-muted-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Rules</button>
        <span className="text-muted-foreground">{rule.title} · {left} to go{streak >= 3 ? ` · 🔥 ${streak}` : ""}</span>
      </div>

      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#34C759]">{STAGE_NAME[card.stage]}</div>

        {card.stage === 0 && (
          <div>
            <div className="text-sm text-muted-foreground">How do you say this in French?</div>
            <div className="text-3xl font-bold mt-1">{card.word.en}</div>
            {card.word.gender && card.word.pos === "noun" && (
              <div className="text-xs text-muted-foreground mt-1">({card.word.gender === "f" ? "feminine: une / la" : "masculine: un / le"})</div>
            )}
          </div>
        )}
        {card.stage === 1 && (
          <div>
            <div className="text-sm text-muted-foreground">Fill the gap with <b className="text-foreground">{card.word.en}</b></div>
            <div className="text-2xl font-semibold mt-1" translate="no">{card.frame.replace("___", "_____")}</div>
          </div>
        )}
        {card.stage === 2 && (
          <div>
            <div className="text-sm text-muted-foreground">
              {subModel ? <>Change the sentence to use <b className="text-foreground">{card.word.en}</b></> : <>Write the sentence with <b className="text-foreground">{card.word.en}</b></>}
            </div>
            <div className="text-lg mt-1 text-muted-foreground" translate="no">
              {subModel ? subModel.text : card.frame.replace("___", `(${card.word.en})`)}
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); check(); } }}
          readOnly={!!feedback}
          autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
          lang="fr" translate="no"
          placeholder={card.stage === 1 ? "the missing word" : "type in French"}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg focus:outline-none focus:border-[#34C759]"
        />

        {!feedback && (
          <div className="flex flex-wrap gap-1.5">
            {ACCENTS.map((a) => (
              <button key={a} type="button" onClick={() => addAccent(a)} className="w-9 h-9 rounded-lg bg-muted font-semibold">{a}</button>
            ))}
            <button type="button" onClick={() => setShowTip((v) => !v)} className="ml-auto h-9 px-3 rounded-lg bg-muted text-sm flex items-center gap-1">
              <Lightbulb className="w-4 h-4" /> Rule
            </button>
          </div>
        )}
        {showTip && !feedback && <p className="text-sm text-muted-foreground">{rule.tip}</p>}

        {feedback && (
          <div className={`rounded-xl p-3 text-sm ${feedback.ok ? "bg-[#34C759]/15" : "bg-[#FF3B30]/15"}`}>
            <div className="flex items-center gap-2 font-semibold">
              {feedback.ok ? <Check className="w-4 h-4 text-[#34C759]" /> : <X className="w-4 h-4 text-[#FF3B30]" />}
              {feedback.ok ? (feedback.almost ? "Almost — watch the accents!" : "Correct!") : "Not quite — here it is:"}
              <button type="button" onClick={() => speak(feedback.answer)} className="ml-auto" aria-label="Listen"><Volume2 className="w-4 h-4" /></button>
            </div>
            <div className="mt-1 text-base" translate="no">{feedback.answer}</div>
          </div>
        )}

        <Button className="w-full h-11" onClick={check}>{feedback ? "Next →" : "Check"}</Button>
      </div>
    </section>
  );
}
