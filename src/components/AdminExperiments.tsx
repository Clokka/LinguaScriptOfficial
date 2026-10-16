import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { compare, MIN_SAMPLE } from "@/lib/experiments";
import { toast } from "sonner";

interface Row { variant: string; segment_value: string; views: number; ctas: number; signups: number }
interface Experiment { key: string; name: string; variants: string[]; status: string; winner: string | null; ai_summary: string | null }

const DIMENSIONS = [
  { id: "all", label: "Everyone" },
  { id: "region", label: "Location" },
  { id: "device", label: "Device" },
  { id: "browser_language", label: "Language" },
  { id: "motivation", label: "Motivation" },
  { id: "source", label: "Traffic source" },
];

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "–");

export const AdminExperiments = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [active, setActive] = useState<string>("");
  const [dim, setDim] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);

  useEffect(() => {
    (supabase as any).from("experiments").select("*").order("created_at").then(({ data }: any) => {
      setExperiments(data || []);
      if (data?.[0]) setActive(data[0].key);
    });
  }, []);

  const load = useCallback(async () => {
    if (!active) return;
    const { data, error } = await (supabase as any).rpc("experiment_results", { _key: active, _dimension: dim });
    if (error) { setError(error.message); setRows([]); return; }
    setError(null);
    setRows((data || []).map((r: any) => ({ ...r, views: Number(r.views), ctas: Number(r.ctas), signups: Number(r.signups) })));
  }, [active, dim]);
  useEffect(() => { void load(); }, [load]);

  const exp = experiments.find((e) => e.key === active);
  const segments = Array.from(new Set(rows.map((r) => r.segment_value)));

  const summarise = async () => {
    setSummarising(true);
    const { data, error } = await supabase.functions.invoke("experiment-insights", { body: { key: active } });
    setSummarising(false);
    if (error) {
      const details = (error as any).context ? await (error as any).context.text().catch(() => error.message) : error.message;
      toast.error(`AI summary failed: ${details}`);
      return;
    }
    setExperiments((xs) => xs.map((e) => (e.key === active ? { ...e, ai_summary: data.summary } : e)));
  };

  return (
    <section className="mt-12 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
        <FlaskConical className="w-5 h-5 text-primary" /> A/B tests
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Each visitor stays in one version. A winner needs {MIN_SAMPLE.toLocaleString()} visitors per version and 95% confidence.
      </p>
      {error && <p className="text-sm text-destructive mb-3">{error === "not_admin" ? "Sign in as an admin to see results." : error}</p>}

      <div className="flex flex-wrap gap-2 mb-3">
        {experiments.map((e) => (
          <Button key={e.key} size="sm" variant={e.key === active ? "default" : "outline"} onClick={() => setActive(e.key)}>{e.name}</Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {DIMENSIONS.map((d) => (
          <Button key={d.id} size="sm" variant={d.id === dim ? "secondary" : "ghost"} onClick={() => setDim(d.id)}>{d.label}</Button>
        ))}
      </div>

      {segments.length === 0 && !error && <p className="text-sm text-muted-foreground">No visitors yet.</p>}
      {segments.map((seg) => {
        const segRows = rows.filter((r) => r.segment_value === seg);
        const control = segRows.find((r) => r.variant === "control");
        return (
          <div key={seg} className="mb-5">
            {dim !== "all" && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{seg}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left">
                  <tr><th className="py-1">Version</th><th>Visitors</th><th>Clicked sign up</th><th>Signed up</th><th>vs control</th></tr>
                </thead>
                <tbody>
                  {segRows.map((r) => {
                    const cmp = control && r.variant !== "control" ? compare(control.signups, control.views, r.signups, r.views) : null;
                    const enough = control && r.views >= MIN_SAMPLE && control.views >= MIN_SAMPLE;
                    const wins = cmp && enough && cmp.confidence >= 0.95 && cmp.lift > 0;
                    return (
                      <tr key={r.variant} className="border-t border-border">
                        <td className="py-1.5 font-medium text-foreground">{r.variant}{wins && <Trophy className="inline w-4 h-4 ml-1 text-accent" />}</td>
                        <td>{r.views}</td>
                        <td>{r.ctas} ({pct(r.ctas, r.views)})</td>
                        <td>{r.signups} ({pct(r.signups, r.views)})</td>
                        <td className="text-muted-foreground">
                          {cmp ? `${cmp.lift >= 0 ? "+" : ""}${(cmp.lift * 100).toFixed(0)}% · ${(cmp.confidence * 100).toFixed(0)}% sure${enough ? "" : " · too few visitors"}` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="mt-4 rounded-xl bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> AI summary</p>
          <Button size="sm" variant="outline" disabled={!active || summarising} onClick={summarise}>{summarising ? "Thinking…" : "Summarise results"}</Button>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exp?.ai_summary || "No summary yet."}</p>
      </div>
    </section>
  );
};
