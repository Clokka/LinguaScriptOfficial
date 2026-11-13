// /english/a1/checklist — every A1 "I can…" skill as a tick box, grouped like the CEFR.
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { CHECKLIST, CHECK_IDS } from "@/lib/english/a1/checklist";
import { checksDone } from "@/lib/english/a1/progress";
import { track } from "@/lib/analytics";
import { A1Nav, Bar, useA1Progress } from "./A1Shared";

export default function A1Checklist() {
  const [p, update] = useA1Progress();
  const done = checksDone(p);
  const toggle = (id: string) => update((prev) => {
    const has = prev.checks.includes(id);
    const next = { ...prev, checks: has ? prev.checks.filter((x) => x !== id) : [...prev.checks, id] };
    track("a1_checklist_ticked", { done: checksDone(next) });
    return next;
  });

  return (
    <>
      <Seo title="English A1 checklist: every skill you need, as tick boxes"
        description="A complete English A1 checklist: everyday basics, listening, reading, speaking, conversation and writing. Tick each 'I can…' skill and see where to practise it."
        path="/english/a1/checklist" />
      <MarketingLayout eyebrow="English A1 · checklist" heading="A1 checklist: every skill you need"
        intro={<>Every A1 skill, grouped the way the CEFR groups them. Tick a box when you can really do it, and use the link to practise. Honest rule: only tick it if you could do it tomorrow without help.</>}
        cta={{ label: "Save your progress free", to: "/auth?next=/english/a1/checklist" }}>
        <A1Nav />
        <div className="not-prose mb-2 space-y-2 rounded-2xl border border-border bg-card p-5">
          <p className="font-bold text-foreground">{done} of {CHECK_IDS.length} skills ticked</p>
          <Bar pct={(done / CHECK_IDS.length) * 100} />
          <p className="text-xs text-muted-foreground">Counts towards your A1 ready %. Saved on this device.</p>
        </div>

        {CHECKLIST.map((g) => {
          const n = g.items.filter((i) => p.checks.includes(i.id)).length;
          return (
            <section key={g.id}>
              <H2>{g.title} <span className="text-base font-semibold text-muted-foreground">({n}/{g.items.length})</span></H2>
              <ul className="not-prose grid gap-2">
                {g.items.map((i) => {
                  const checked = p.checks.includes(i.id);
                  return (
                    <li key={i.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${checked ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
                      <label className="flex min-w-0 flex-[1_1_260px] cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={checked} onChange={() => toggle(i.id)} className="mt-0.5 h-5 w-5 flex-none accent-[hsl(var(--primary))]" />
                        <span className={checked ? "text-foreground" : "text-foreground/90"}>{i.text}</span>
                      </label>
                      {i.practice && (i.practice.ready
                        ? <Link to={i.practice.to} className="text-xs font-semibold text-primary hover:underline">{i.practice.label} →</Link>
                        : <span className="text-xs text-muted-foreground">{i.practice.label}: coming soon</span>)}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <p className="text-sm">Based on the Council of Europe's CEFR A1 descriptors, written in our own words. <Link to="/english/a1/sources" className="text-primary hover:underline">Sources</Link>.</p>
      </MarketingLayout>
    </>
  );
}
