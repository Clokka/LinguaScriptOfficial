// The Speed Run lesson screens shown on the dark Stage.
import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ExternalLink, Sparkles, Volume2 } from "lucide-react";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { ExportDeckButtons } from "@/components/ExportDeckButtons";
import { DECK_COLOURS, FIRST_REVIEW_MINUTES, REVIEW_GROWTH, REVIEW_LADDER_DAYS } from "@linguascript/core/review";
import { COURSES, courseHref, isAffiliate } from "@/lib/landingCourses";
import type { LearnLang } from "@/lib/landingSegment";
import { track } from "@/lib/analytics";
import { playSfx } from "@/lib/sfx";
import type { RootTip, SpeedRunCourse, VerbCard } from "@/lib/speedRun";
import { Eyebrow, StageButton, speak } from "./Stage";

const RED = DECK_COLOURS.red.hex;
const GREEN = DECK_COLOURS.green.hex;
const GOLD = DECK_COLOURS.gold.hex;

const list = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } };
const rise = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 26 } },
} as const;

export interface MeetWord { rank: number; word: string; translation: string }

export function MeetStep({ words, course, lang, tint, onNext }: {
  words: MeetWord[]; course: SpeedRunCourse; lang: string; tint: string; onNext: () => void;
}) {
  const [heard, setHeard] = useState<Set<number>>(new Set());
  return (
    <section>
      <Eyebrow>Course {course.n} · meet your words</Eyebrow>
      <h2 className="mt-3 text-3xl font-black leading-tight">
        {course.n === 1
          ? <>These {words.length} words are about <span style={{ color: tint }}>1 in every 10</span> words you'll hear</>
          : "Your next words, most common first"}
      </h2>
      <p className="mt-2 text-sm text-white/55">Tap each one to hear it. Say it out loud.</p>
      <motion.ul variants={list} initial="hidden" animate="show" className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {words.map((w) => {
          const on = heard.has(w.rank);
          return (
            <motion.li key={w.rank} variants={rise}>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => { playSfx("tap"); speak(w.word, lang); setHeard((h) => new Set(h).add(w.rank)); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08]"
              >
                <span className="text-2xl font-black" style={{ color: RED }} translate="no" lang={lang}>{w.word}</span>
                <span className="flex-1 truncate text-white/60">{w.translation}</span>
                <motion.span animate={{ scale: on ? [1, 1.3, 1] : 1, opacity: on ? 1 : 0.35 }}>
                  <Volume2 className="h-4 w-4" />
                </motion.span>
              </motion.button>
            </motion.li>
          );
        })}
      </motion.ul>
      <StageButton tint={tint} onClick={onNext}>Next</StageButton>
    </section>
  );
}

export function VerbStep({ verb, lang, tint, onNext }: { verb: VerbCard; lang: string; tint: string; onNext: () => void }) {
  return (
    <section>
      <Eyebrow>Your first verb</Eyebrow>
      <h2 className="mt-3 text-4xl font-black" translate="no" lang={lang}>{verb.verb}</h2>
      <p className="text-lg text-white/60">{verb.meaning}</p>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{verb.note}</p>
      <motion.ul variants={list} initial="hidden" animate="show" className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        {verb.forms.map(([who, form]) => {
          const hot = verb.inLesson.includes(form);
          return (
            <motion.li key={who} variants={rise} className="border-b border-white/5 last:border-0">
              <button
                onClick={() => { playSfx("tap"); speak(`${who.split(" / ")[0]} ${form}`, lang); }}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-white/5"
              >
                <span className="w-28 text-white/50" translate="no" lang={lang}>{who}</span>
                <span className="text-xl font-black" style={{ color: hot ? RED : "white" }} translate="no" lang={lang}>{form}</span>
                {hot && <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${RED}26`, color: RED }}>in your lesson</span>}
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
      <StageButton tint={tint} onClick={onNext}>Build sentences</StageButton>
    </section>
  );
}

export function RootsStep({ tip, lang, tint, onNext }: { tip: RootTip; lang: string; tint: string; onNext: () => void }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  return (
    <section>
      <Eyebrow>Word roots</Eyebrow>
      <h2 className="mt-3 text-3xl font-black leading-tight">{tip.headline}</h2>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{tip.body}</p>
      <p className="mt-4 text-xs text-white/45">Tap a card to flip it.</p>
      <motion.ul variants={list} initial="hidden" animate="show" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tip.patterns.map(([en, target], i) => {
          const shown = open.has(i);
          return (
            <motion.li key={en} variants={rise} style={{ perspective: 800 }}>
              <motion.button
                onClick={() => { playSfx(shown ? "tap" : "correct"); setOpen((o) => { const n = new Set(o); if (shown) n.delete(i); else n.add(i); return n; }); if (!shown) speak(target, lang); }}
                animate={{ rotateX: shown ? 360 : 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="flex h-20 w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-center"
              >
                {shown
                  ? <span className="text-2xl font-black" style={{ color: "#C4B5FD" }} translate="no" lang={lang}>{target}</span>
                  : <span className="text-sm text-white/75">{en}</span>}
              </motion.button>
            </motion.li>
          );
        })}
      </motion.ul>
      {tip.falseFriend && <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">⚠️ {tip.falseFriend}</p>}
      {tip.source && (
        <p className="mt-3 text-xs text-white/40">
          Source: <a href={tip.source.href} target="_blank" rel="noopener noreferrer" className="underline">{tip.source.label}</a>
        </p>
      )}
      <StageButton tint={tint} onClick={onNext}>Next</StageButton>
    </section>
  );
}

const TIERS: ChameleonTier[] = ["red", "orange", "green"];

/** Counts up like a motion-graphics number. */
function CountUp({ from, to, delay }: { from: number; to: number; delay: number }) {
  const reduce = useReducedMotion();
  const v = useMotionValue(reduce ? to : from);
  const shown = useTransform(v, (x) => `~${Math.round(x)}%`);
  useEffect(() => {
    if (reduce) return;
    const c = animate(v, to, { duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [v, to, delay, reduce]);
  return <motion.span>{shown}</motion.span>;
}

export function Celebrate({ course, prevPct, langName, level, onNext }: {
  course: SpeedRunCourse; prevPct: number; langName: string; level: number; onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const [tier, setTier] = useState(reduce ? 2 : 0);
  useEffect(() => {
    if (reduce) { playSfx("levelUp"); return; }
    const t1 = setTimeout(() => { setTier(1); playSfx("correct"); }, 650);
    const t2 = setTimeout(() => {
      setTier(2);
      playSfx("levelUp");
      // canvas-confetti loads only here, never in the first-load bundle.
      import("canvas-confetti")
        .then(({ default: confetti }) => {
          const colors = [RED, DECK_COLOURS.orange.hex, GREEN, GOLD];
          confetti({ particleCount: 140 + course.n * 30, spread: 95, origin: { y: 0.55 }, colors, zIndex: 60 });
          setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, zIndex: 60 }), 250);
          setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, zIndex: 60 }), 400);
        })
        .catch(() => {});
    }, 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [course.n, reduce]);

  const R = 92;
  const C = 2 * Math.PI * R;
  return (
    <section className="flex flex-col items-center text-center">
      <Eyebrow>Course {course.n} complete</Eyebrow>
      <div className="relative mt-4 h-60 w-60">
        <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
          <motion.circle
            cx="100" cy="100" r={R} fill="none" stroke={GREEN} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C * (1 - prevPct / 100) }}
            animate={{ strokeDashoffset: C * (1 - course.pct / 100) }}
            transition={{ duration: reduce ? 0 : 1.4, delay: reduce ? 0 : 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <motion.div
          className="absolute inset-6 flex items-center justify-center"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
        >
          <ChameleonMascot tier={TIERS[tier]} party={tier === 2} className="w-full" />
        </motion.div>
      </div>
      <p className="mt-2 text-7xl font-black tabular-nums" style={{ color: GREEN }}>
        <CountUp from={prevPct} to={course.pct} delay={1.2} />
      </p>
      <h2 className="mt-1 text-2xl font-black">of the {langName} words you'll hear</h2>
      <p className="mt-3 max-w-md text-white/65">
        {course.win}{course.n <= 2 ? " They're small words, but they're everywhere. You'll spot them in your very first video." : ""}
      </p>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 2 }}
        className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold"
        style={{ background: `${GREEN}22`, color: GREEN }}
      >
        <Sparkles className="h-4 w-4" /> Level {level}
      </motion.p>
      <StageButton tint={GREEN} onClick={onNext}>Next</StageButton>
    </section>
  );
}

const CYCLE = [
  { c: RED, label: "New" },
  { c: DECK_COLOURS.orange.hex, label: "Learning" },
  { c: GREEN, label: "Known" },
  { c: GOLD, label: "Review me!" },
];

export function HowItWorks({ sampleWord, lang, tint, onNext }: { sampleWord: string; lang: string; tint: string; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % CYCLE.length), 1300);
    return () => clearInterval(t);
  }, [reduce]);
  const ladder = [`${FIRST_REVIEW_MINUTES} min`, ...REVIEW_LADDER_DAYS.map((d) => `${d} day${d === 1 ? "" : "s"}`)];
  return (
    <section>
      <Eyebrow>How LinguaScript works</Eyebrow>
      <h2 className="mt-3 text-3xl font-black leading-tight">Every word changes colour as you learn it</h2>
      <div className="mt-8 flex flex-col items-center">
        <motion.span
          className="text-5xl font-black"
          animate={{ color: CYCLE[i].c, textShadow: `0 0 30px ${CYCLE[i].c}66` }}
          transition={{ duration: 0.5 }}
          translate="no"
          lang={lang}
        >
          {sampleWord}
        </motion.span>
        <motion.span key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm font-bold" style={{ color: CYCLE[i].c }}>
          {CYCLE[i].label}
        </motion.span>
      </div>
      <p className="mt-8 text-sm text-white/70">
        Get a card right: red → orange. Right again: green. Then the word turns <b style={{ color: GOLD }}>gold</b> when it's time to check you still remember:
      </p>
      <div className="relative mt-5">
        <motion.div
          className="absolute left-0 right-0 top-1/2 h-0.5 origin-left -translate-y-1/2"
          style={{ background: `${GOLD}55` }}
          initial={{ scaleX: reduce ? 1 : 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <motion.ol variants={list} initial="hidden" animate="show" className="relative flex justify-between">
          {ladder.map((s) => (
            <motion.li key={s} variants={rise} className="flex flex-col items-center">
              <span className="h-3 w-3 rounded-full" style={{ background: GOLD, boxShadow: `0 0 12px ${GOLD}` }} />
              <span className="mt-2 text-[11px] font-bold text-white/80">{s}</span>
            </motion.li>
          ))}
        </motion.ol>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-white/70">
        Then ×{REVIEW_GROWTH} each time, forever. This is <b>spaced repetition</b>: each check comes just before you'd forget.
        Your first gold check is in {FIRST_REVIEW_MINUTES} minutes. Come back for it!
      </p>
      <StageButton tint={tint} onClick={onNext}>Got it</StageButton>
    </section>
  );
}

export function NextUp({ course, nextCourse, language, langName, exportCards, tint, onContinue }: {
  course: SpeedRunCourse; nextCourse?: SpeedRunCourse; language: string; langName: string;
  exportCards: { word: string; meaning: string }[]; tint: string; onContinue: () => void;
}) {
  const recs = COURSES[language as LearnLang] ?? [];
  return (
    <section>
      <Eyebrow>The full recipe</Eyebrow>
      <h2 className="mt-3 text-3xl font-black leading-tight">Mix as many ways of learning as you can</h2>
      <p className="mt-3 text-sm leading-relaxed text-white/70">
        The fastest learners get lots of immersion <i>and</i> lots of study. LinguaScript gives you quick wins with the most useful words.
        Watching, reading and a good course do the rest. Here's an optional course to take alongside:
      </p>
      {recs.length > 0 ? (
        <motion.ul variants={list} initial="hidden" animate="show" className="mt-5 space-y-2">
          {recs.map((c) => (
            <motion.li key={c.url} variants={rise}>
              <a
                href={courseHref(c)}
                target="_blank"
                rel={isAffiliate(c) ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                onClick={() => track("partner_course_clicked", { course: c.name, language, affiliate: isAffiliate(c) })}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.08]"
              >
                <span className="flex-1">
                  <span className="block font-bold">{c.name}</span>
                  <span className="block text-sm text-white/55">{c.by} · {c.note}</span>
                  {isAffiliate(c) && <span className="block text-xs text-white/45">Affiliate link: we may earn a commission, at no cost to you.</span>}
                </span>
                <ExternalLink className="h-4 w-4 text-white/50" />
              </a>
            </motion.li>
          ))}
        </motion.ul>
      ) : (
        <p className="mt-5 text-sm text-white/55">We're still choosing a course we trust for {langName}.</p>
      )}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 [&_button]:border-white/20 [&_button]:bg-transparent [&_button]:text-white [&_p]:text-white/55">
        <p className="mb-3 font-bold !text-white">Already use Anki or Quizlet?</p>
        <ExportDeckButtons cards={exportCards} deckName={`LinguaScript ${langName} top ${course.to}`} />
      </div>
      <StageButton tint={tint} onClick={onContinue}>
        {nextCourse ? `Next: course ${nextCourse.n} (${nextCourse.pct}%)` : "Back to Speed Run"}
      </StageButton>
    </section>
  );
}
