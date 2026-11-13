// /english/a1/grammar/:slug — one grammar unit: explain → examples → mistakes → check.
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { UNITS, PASS_SCORE, isReady, unitBySlug } from "@/lib/english/a1/grammar";
import { track } from "@/lib/analytics";
import { A1Nav, Rich, SpeakButton, useA1Progress } from "./A1Shared";

export default function A1Unit() {
  const { slug = "" } = useParams();
  return <UnitPage key={slug} slug={slug} />;
}

function UnitPage({ slug }: { slug: string }) {
  const unit = unitBySlug(slug);
  const [, update] = useA1Progress();
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);

  if (!unit || !isReady(unit)) return <Navigate to="/english/a1/grammar" replace />;
  const next = UNITS.find((u) => u.n === unit.n + 1);
  const score = unit.check.filter((c, i) => picked[i] === c.answer).length;
  const allAnswered = unit.check.every((_, i) => picked[i] != null);

  const submit = () => {
    setDone(true);
    update((p) => ({ ...p, units: { ...p.units, [unit.slug]: Math.max(p.units[unit.slug] ?? 0, score) } }));
    track("a1_unit_completed", { unit: unit.slug, score, passed: score >= PASS_SCORE });
  };
  const retry = () => { setPicked({}); setDone(false); };

  return (
    <>
      <Seo title={`${unit.title}: English A1 grammar (unit ${unit.n})`}
        description={`${unit.canDo} A short, clear explanation of ${unit.title} with examples, common mistakes and a free 8-question check.`}
        path={`/english/a1/grammar/${unit.slug}`} type="article" />
      <MarketingLayout eyebrow={`English A1 · grammar unit ${unit.n} of ${UNITS.length}`} heading={unit.title}
        intro={<>You'll be able to: <strong className="text-foreground">{unit.canDo}</strong></>}
        cta={{ label: "Save your progress free", to: `/auth?next=/english/a1/grammar/${unit.slug}` }}>
        <A1Nav />

        <H2>How it works</H2>
        {unit.explain.map((e) => <p key={e}><Rich text={e} /></p>)}

        {unit.table && (
          <div className="not-prose overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-muted/50 text-foreground"><tr>{unit.table.head.map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
              <tbody translate="no">
                {unit.table.rows.map((r) => <tr key={r.join()} className="border-t border-border">{r.map((c, i) => <td key={i} className={`p-3 ${i === 0 ? "font-semibold text-foreground" : ""}`}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        )}

        <H2>Examples</H2>
        <ul className="not-prose grid gap-2">
          {unit.examples.map((ex) => (
            <li key={ex} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <SpeakButton text={ex} />
              <span className="text-foreground" translate="no">{ex}</span>
            </li>
          ))}
        </ul>

        <H2>Common mistakes</H2>
        <ul className="not-prose grid gap-2">
          {unit.mistakes.map((m) => (
            <li key={m.wrong} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1 text-destructive line-through" translate="no"><X className="h-3.5 w-3.5" aria-label="Wrong" />{m.wrong}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary" translate="no"><Check className="h-3.5 w-3.5" aria-label="Right" />{m.right}</span>
              </span>
              <span className="mt-1 block text-muted-foreground">{m.note}</span>
            </li>
          ))}
        </ul>

        <H2>Check: 8 questions</H2>
        <ol className="not-prose grid gap-4">
          {unit.check.map((c, i) => (
            <li key={c.q} className="rounded-2xl border border-border bg-card p-4">
              <fieldset>
                <legend className="mb-3 font-semibold text-foreground"><span className="mr-2 text-muted-foreground">{i + 1}.</span><span translate="no">{c.q}</span></legend>
                <div className="flex flex-wrap gap-2">
                  {c.options.map((o, oi) => {
                    const chosen = picked[i] === oi;
                    const tone = !done ? (chosen ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground hover:border-primary")
                      : oi === c.answer ? "border-primary bg-primary/15 text-foreground" : chosen ? "border-destructive bg-destructive/10 text-foreground" : "border-border text-muted-foreground";
                    return (
                      <label key={o} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${tone}`}>
                        <input type="radio" className="sr-only" name={`q${i}`} checked={chosen} disabled={done} onChange={() => setPicked({ ...picked, [i]: oi })} />
                        <span translate="no">{o}</span>
                      </label>
                    );
                  })}
                </div>
                {done && <p className={`mt-3 text-sm ${picked[i] === c.answer ? "text-primary" : "text-muted-foreground"}`}>{picked[i] === c.answer ? "Right! " : "Not quite. "}{c.why}</p>}
              </fieldset>
            </li>
          ))}
        </ol>

        <div className="not-prose mt-6 rounded-2xl border border-border bg-card p-5">
          {!done ? (
            <button type="button" disabled={!allAnswered} onClick={submit}
              className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {allAnswered ? "Check my answers" : `Answer all 8 to check (${Object.keys(picked).length}/8)`}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="mr-auto text-lg font-bold text-foreground">
                {score}/8 {score >= PASS_SCORE ? "🎉 Unit passed!" : `· you need ${PASS_SCORE} to pass`}
              </p>
              <button type="button" onClick={retry} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground">Try again</button>
              {next && (isReady(next)
                ? <Link to={`/english/a1/grammar/${next.slug}`} onClick={() => window.scrollTo(0, 0)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Next: {next.title} →</Link>
                : <Link to="/english/a1/words" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Next: the 100 key words →</Link>)}
            </div>
          )}
        </div>
      </MarketingLayout>
    </>
  );
}
