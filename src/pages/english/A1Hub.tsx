// /english/a1 — "Pass English A1: the free guide" (docs/plans/english-a1-hub.md).
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { UNITS } from "@/lib/english/a1/grammar";
import { A1_TEST } from "@/lib/english/a1/test";
import { A1_WORD_RANGE, A1_WORD_TARGET, a1Ready, unitsPassed, wordsKnown } from "@/lib/english/a1/progress";
import { A1Nav, Bar, useA1Progress } from "./A1Shared";

const CAN_DO = [
  "Introduce yourself and others: name, age, country, job.",
  "Ask and answer simple questions about where you live, people you know and things you have.",
  "Understand everyday words: numbers, prices, times, days, family, food.",
  "Read signs, short messages and simple forms.",
  "Write a short message or fill in a form with your details.",
  "Talk slowly and simply when the other person helps a little.",
];

export default function A1Hub() {
  const [p] = useA1Progress();
  const ready = a1Ready(p);
  const passed = unitsPassed(p);
  const known = wordsKnown(p);
  return (
    <>
      <Seo
        title="Pass English A1: free grammar, words and practice test"
        description="A free, clear guide to English level A1 (CEFR): 20 grammar units, the A1 words starting with the 100 most common, and a 20-question practice test with listening. Track your progress as you go."
        path="/english/a1"
        jsonLd={{
          "@context": "https://schema.org", "@type": "Course",
          name: "English A1: free guide", description: "Grammar, vocabulary and a practice test for CEFR level A1 English.",
          provider: { "@type": "Organization", name: "LinguaScript", sameAs: "https://linguascript.co.uk" },
          educationalLevel: "CEFR A1", inLanguage: "en", isAccessibleForFree: true,
        }}
      />
      <MarketingLayout
        eyebrow="English A1 · free guide"
        heading="Pass English A1"
        intro={<>Everything you need for English level <strong className="text-foreground">A1</strong>, the first level of the CEFR scale used by schools, universities and exams worldwide. Clear grammar, the most useful words first, and a free practice test.</>}
        cta={{ label: "Save your progress free", to: "/auth?next=/english/a1" }}
      >
        <A1Nav />

        <section className="not-prose rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Your A1 progress</p>
              <p className="text-4xl font-extrabold text-foreground">{ready}% <span className="text-base font-semibold text-muted-foreground">A1 ready</span></p>
            </div>
            <Link to={passed === 0 ? "/english/a1/test" : "/english/a1/grammar"} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
              {passed === 0 && !p.test ? "Take the practice test" : "Keep going"}
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><p className="text-sm text-muted-foreground">Grammar units passed</p><p className="font-bold text-foreground">{passed} / {UNITS.length}</p><Bar pct={(passed / UNITS.length) * 100} /></div>
            <div className="space-y-1.5"><p className="text-sm text-muted-foreground">A1 words known</p><p className="font-bold text-foreground">{known} <span className="font-normal text-muted-foreground">of about {A1_WORD_TARGET}</span></p><Bar pct={(known / A1_WORD_TARGET) * 100} /></div>
            <div className="space-y-1.5"><p className="text-sm text-muted-foreground">Practice test</p><p className="font-bold text-foreground">{p.test ? `${p.test.score} / ${A1_TEST.length}` : "Not taken yet"}</p><Bar pct={p.test ? (p.test.score / A1_TEST.length) * 100 : 0} /></div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Saved on this device.</p>
        </section>

        <H2>What A1 means</H2>
        <p>A1 is the beginner level of the <strong className="text-foreground">Common European Framework of Reference (CEFR)</strong>. At A1 you can:</p>
        <ul className="list-disc space-y-1.5 pl-6">{CAN_DO.map((c) => <li key={c}>{c}</li>)}</ul>

        <H2>Three steps</H2>
        <div className="not-prose grid gap-4 sm:grid-cols-3">
          {[
            { to: "/english/a1/grammar", n: "1", t: "Grammar", d: "20 short units. Each one has examples, common mistakes and an 8-question check." },
            { to: "/english/a1/words", n: "2", t: "A1 words", d: `A1 needs about ${A1_WORD_RANGE} words. Start with the 100 most common: they make up about half of everyday English.` },
            { to: "/english/a1/test", n: "3", t: "Practice test", d: "20 questions: grammar, words, reading and listening. See what to study next." },
          ].map((c) => (
            <Link key={c.to} to={c.to} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary">
              <span className="text-sm font-bold text-primary">Step {c.n}</span>
              <p className="mt-1 text-lg font-bold text-foreground">{c.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
            </Link>
          ))}
        </div>

        <div className="not-prose mt-8 rounded-2xl border border-border bg-card p-6">
          <p className="text-lg font-bold text-foreground">Planning to study abroad?</p>
          <p className="mt-1 text-sm text-muted-foreground">Universities usually ask for IELTS, TOEFL, PTE or the Duolingo English Test, at B2 or higher. A1 is your first step on that path. See which exam you need and what score universities usually ask for.</p>
          <Link to="/english/exams" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Exams and study abroad →</Link>
        </div>

        <p className="text-sm">This guide is written by LinguaScript and follows the CEFR A1 level. It's for learning and practice. It is not an official exam. <Link to="/english/a1/sources" className="text-primary hover:underline">How we built it and our sources</Link>.</p>
      </MarketingLayout>
    </>
  );
}
