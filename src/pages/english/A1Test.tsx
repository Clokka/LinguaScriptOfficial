// /english/a1/test — free 20-question A1 practice test (not an official exam).
import { useState } from "react";
import { Link } from "react-router-dom";
import { Volume2 } from "lucide-react";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { A1_TEST, scoreBand, type Skill } from "@/lib/english/a1/test";
import { unitBySlug, isReady } from "@/lib/english/a1/grammar";
import { track } from "@/lib/analytics";
import { A1Nav, Bar, speak, useA1Progress } from "./A1Shared";

const SKILLS: Skill[] = ["Grammar", "Vocabulary", "Reading", "Listening"];

export default function A1Test() {
  const [p, update] = useA1Progress();
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const score = A1_TEST.filter((q, i) => picked[i] === q.answer).length;
  const answered = Object.keys(picked).length;

  const submit = () => {
    setDone(true);
    update((prev) => ({ ...prev, test: { score, at: new Date().toISOString() } }));
    track("a1_test_finished", { score });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const restart = () => { setPicked({}); setDone(false); window.scrollTo({ top: 0 }); };

  const study = [...new Set(A1_TEST.filter((q, i) => q.study && picked[i] !== q.answer).map((q) => q.study!))]
    .map((s) => unitBySlug(s)).filter((u): u is NonNullable<typeof u> => !!u);
  const band = scoreBand(score);

  return (
    <>
      <Seo title="Free English A1 practice test: grammar, vocabulary, reading, listening"
        description="Take a free 20-question English A1 practice test in about 15 minutes. Get your score by skill and a list of what to study next."
        path="/english/a1/test" />
      <MarketingLayout eyebrow="English A1 · practice test" heading="Free A1 practice test"
        intro={<>20 questions, about 15 minutes: grammar, vocabulary, reading and listening (turn your sound on). You get your score straight away, with what to study next.{p.test && !done ? <> Your last score: <strong className="text-foreground">{p.test.score}/20</strong>.</> : null}</>}
        cta={{ label: "Save your results free", to: "/auth?next=/english/a1/test" }}>
        <A1Nav />

        {done && (
          <section className="not-prose mb-8 rounded-2xl border border-primary/50 bg-card p-6" aria-live="polite">
            <p className="text-sm font-semibold text-muted-foreground">Your result</p>
            <p className="text-4xl font-extrabold text-foreground">{score} / {A1_TEST.length}</p>
            <p className="mt-1 text-lg font-bold text-primary">{band.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{band.advice}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {SKILLS.map((s) => {
                const qs = A1_TEST.map((q, i) => ({ q, i })).filter((x) => x.q.skill === s);
                const right = qs.filter((x) => picked[x.i] === x.q.answer).length;
                return <div key={s} className="space-y-1"><p className="flex justify-between text-sm"><span className="text-foreground">{s}</span><span className="text-muted-foreground">{right}/{qs.length}</span></p><Bar pct={(right / qs.length) * 100} /></div>;
              })}
            </div>
            {study.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-foreground">Study next:</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {study.map((u) => (
                    <li key={u.slug}>{isReady(u)
                      ? <Link to={`/english/a1/grammar/${u.slug}`} className="inline-block rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:border-primary">{u.title}</Link>
                      : <span className="inline-block rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">{u.title} (coming soon)</span>}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={restart} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground">Take it again</button>
              <Link to="/english/a1/words" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Learn your A1 words →</Link>
            </div>
          </section>
        )}

        {SKILLS.map((s) => (
          <section key={s}>
            <H2>{s}</H2>
            <ol className="not-prose grid gap-4">
              {A1_TEST.map((q, i) => ({ q, i })).filter((x) => x.q.skill === s).map(({ q, i }) => (
                <li key={i} className="rounded-2xl border border-border bg-card p-4">
                  <fieldset>
                    {q.text && <p className="mb-3 rounded-xl bg-muted/50 p-3 text-sm text-foreground" translate="no">{q.text}</p>}
                    {q.say && (
                      <button type="button" onClick={() => speak(q.say!)} className="mb-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary">
                        <Volume2 className="h-4 w-4" />Play the audio
                      </button>
                    )}
                    <legend className="mb-3 font-semibold text-foreground"><span className="mr-2 text-muted-foreground">{i + 1}.</span><span translate="no">{q.q}</span></legend>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((o, oi) => {
                        const chosen = picked[i] === oi;
                        const tone = !done ? (chosen ? "border-primary bg-primary/10" : "border-border hover:border-primary")
                          : oi === q.answer ? "border-primary bg-primary/15" : chosen ? "border-destructive bg-destructive/10" : "border-border opacity-60";
                        return (
                          <label key={o} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium text-foreground transition-colors ${tone}`}>
                            <input type="radio" className="sr-only" name={`t${i}`} checked={chosen} disabled={done} onChange={() => setPicked({ ...picked, [i]: oi })} />
                            <span translate="no">{o}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </li>
              ))}
            </ol>
          </section>
        ))}

        {!done && (
          <div className="not-prose mt-6">
            <button type="button" onClick={submit} disabled={answered < A1_TEST.length}
              className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {answered < A1_TEST.length ? `Answer all questions (${answered}/${A1_TEST.length})` : "See my result"}
            </button>
          </div>
        )}
        <p className="text-xs">This is a free practice test written by LinguaScript to help you learn. It is not an official CEFR exam or certificate.</p>
      </MarketingLayout>
    </>
  );
}
