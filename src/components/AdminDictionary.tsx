// Admin: fill the shared word dictionary with the 10,000 most common words of
// a language (seed-dictionary function), so word taps and flashcards get their
// meaning instantly instead of waiting on a translator.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/lib/languages";

export function AdminDictionary() {
  const [language, setLanguage] = useState("fr");
  const [target, setTarget] = useState("en");
  const [count, setCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ next: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const stop = useRef(false);

  const refreshCount = async () => {
    const { count: n } = await supabase
      .from("word_dictionary" as any)
      .select("word", { count: "exact", head: true })
      .eq("language", language)
      .eq("target", target);
    setCount(n ?? 0);
  };
  useEffect(() => { void refreshCount(); }, [language, target]);

  const fill = async (lang: string) => {
    let offset = 0;
    while (!stop.current) {
      const { data, error: err } = await supabase.functions.invoke("seed-dictionary", { body: { language: lang, target, offset } });
      if (err || data?.error) throw new Error(`${lang}: ${data?.error || err?.message || "Failed"}`);
      setProgress({ next: data.next, total: data.total });
      if (lang === language) void refreshCount();
      if (data.done) return;
      offset = data.next;
    }
  };

  const run = async (all: boolean) => {
    setRunning(true);
    setError(null);
    stop.current = false;
    const failed: string[] = [];
    try {
      for (const l of all ? LANGUAGES.map((x) => x.code).filter((c) => c !== target) : [language]) {
        if (stop.current) break;
        setCurrent(l);
        // One language failing (no list, a hiccup) doesn't stop the rest.
        try { await fill(l); } catch (e) { failed.push((e as Error).message); }
      }
      if (failed.length) setError(failed.join(" · "));
    } finally {
      setRunning(false);
      setCurrent(null);
      void refreshCount();
    }
  };

  return (
    <section className="glass-panel-strong rounded-2xl p-5 space-y-3">
      <h2 className="text-lg font-bold">Word dictionary</h2>
      <p className="text-sm text-muted-foreground">
        Top 10,000 words per language, translated once. Taps and flashcards read it first.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm" disabled={running}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
        </select>
        <span className="text-muted-foreground">→</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm" disabled={running}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
        </select>
        {running ? (
          <Button variant="outline" onClick={() => { stop.current = true; }}>
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Stop
          </Button>
        ) : (
          <>
            <Button onClick={() => run(false)} disabled={language === target}>Fill 10,000 words</Button>
            <Button variant="outline" onClick={() => run(true)}>All languages</Button>
          </>
        )}
        <span className="text-sm text-muted-foreground tabular-nums">
          {count ?? "…"} in dictionary
          {progress ? ` · ${current ?? ""} ${progress.next.toLocaleString()} / ${progress.total.toLocaleString()} checked` : ""}
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
