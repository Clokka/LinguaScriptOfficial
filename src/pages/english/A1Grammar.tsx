// /english/a1/grammar — the 20 A1 grammar units.
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Seo } from "@/components/Seo";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { UNITS, PASS_SCORE, isReady } from "@/lib/english/a1/grammar";
import { unitsPassed } from "@/lib/english/a1/progress";
import { A1Nav, useA1Progress } from "./A1Shared";

export default function A1Grammar() {
  const [p] = useA1Progress();
  return (
    <>
      <Seo title="English A1 grammar: 20 short units with examples and quizzes"
        description="All the grammar you need for English A1: be, pronouns, a/an/the, plurals, this/that, present simple, can, there is/are and more. Short explanations, real examples and a quick check."
        path="/english/a1/grammar" />
      <MarketingLayout eyebrow="English A1 · grammar" heading="A1 grammar in 20 short units"
        intro={<>Most useful first. Each unit takes about 10 minutes: a short explanation, examples, common mistakes and an 8-question check. Pass with {PASS_SCORE}/8 to tick it off. You've passed <strong className="text-foreground">{unitsPassed(p)} of {UNITS.length}</strong>.</>}
        cta={{ label: "Save your progress free", to: "/auth?next=/english/a1/grammar" }}>
        <A1Nav />
        <ol className="not-prose grid gap-3">
          {UNITS.map((u) => {
            const best = p.units[u.slug];
            const passed = (best ?? 0) >= PASS_SCORE;
            const ready = isReady(u);
            const body = (
              <>
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold ${passed ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {passed ? <Check className="h-4 w-4" aria-label="Passed" /> : u.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-foreground">{u.title}</span>
                  <span className="block text-sm text-muted-foreground">{u.canDo}</span>
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {!ready ? "Coming soon" : best != null ? `Best ${best}/8` : "Start"}
                </span>
              </>
            );
            return (
              <li key={u.slug}>
                {ready
                  ? <Link to={`/english/a1/grammar/${u.slug}`} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary">{body}</Link>
                  : <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border p-4 opacity-70">{body}</div>}
              </li>
            );
          })}
        </ol>
      </MarketingLayout>
    </>
  );
}
