import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, Eyebrow, Skeleton } from "@/components/premium";
import { cleanConfig, DEFAULT_SITE, describeHome } from "@/lib/site/config";
import { configuredHomePaths, HOME_PICKS, savedHomePaths, saveHomePath } from "@/lib/site/homepageChoices";
import { cleanHomePath, isHomeRoute, useHomeRoutes } from "@/lib/site/homeRoutes";
import { type Pending, type useSite } from "@/components/hq/useSite";

// A box you can type any page address into (with the options as suggestions),
// plus "Add to landing page options" to keep a new page in the list.
function PageInput({ id, value, onChange, label, choices, routes, onAdd }: {
  id: string; value: string; onChange: (value: string) => void;
  label: string; choices: [string, string][]; routes: ReturnType<typeof useHomeRoutes>; onAdd: (path: string) => void;
}) {
  const path = cleanHomePath(value);
  const listed = !!path && choices.some(([p]) => p === path);
  const exists = !!path && isHomeRoute(routes, path);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="flex flex-wrap gap-2">
        <Input id={id} list={`${id}-options`} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="Type a page address, e.g. /landing7" className="h-12 min-w-[220px] flex-1 font-mono"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <Button type="button" variant="outline" className="h-12" disabled={!exists || listed} onClick={() => path && onAdd(path)}
          title={!path ? "Type a page address first" : !exists ? "That page doesn't exist on this website yet" : listed ? "Already in the options" : ""}>
          <Plus className="mr-1.5 h-4 w-4" />{listed ? "In the options" : "Add to landing page options"}
        </Button>
      </div>
      <datalist id={`${id}-options`}>{choices.map(([p, name]) => <option key={p} value={p}>{name}</option>)}</datalist>
      <div className="flex flex-wrap gap-1.5">
        {choices.map(([p, name]) => (
          <button key={p} type="button" onClick={() => onChange(p)} title={name}
            className={`rounded-full border px-2.5 py-1 font-mono text-xs ${p === path ? "border-emerald-500 text-emerald-400" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{p}</button>
        ))}
      </div>
      {path && exists && <Button asChild variant="ghost" size="sm"><a href={`${path}?hqpreview=1`} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-2 h-3.5 w-3.5" /> Open this page
      </a></Button>}
    </div>
  );
}

export function HomepageBox({ site, setPending }: { site: ReturnType<typeof useSite>; setPending: (p: Pending) => void }) {
  const routes = useHomeRoutes();
  const home = (site.live ?? DEFAULT_SITE).home;
  const livePaths = configuredHomePaths(home);
  const liveA = livePaths[0] ?? "";
  const liveB = home.mode === "test" ? livePaths[1] ?? "" : "";
  const [a, setA] = useState(liveA);
  const [b, setB] = useState(liveB);
  const [test, setTest] = useState(home.mode === "test");
  const [saved, setSaved] = useState<string[]>(savedHomePaths);
  const add = (path: string) => { setSaved(saveHomePath(path)); toast.success(`${path} added to the landing page options`); };
  useEffect(() => { setA(liveA); setB(liveB); setTest(home.mode === "test"); }, [liveA, liveB, home.mode]);

  // Published custom addresses remain in the menu for the entire team.
  const choices = useMemo(() => {
    const paths = [...saved, ...configuredHomePaths(site.live?.home), ...site.history.flatMap((entry) => configuredHomePaths(entry.config.home))];
    const extra = Array.from(new Set(paths)).filter((p) => p && !HOME_PICKS.some(([known]) => known === p) && isHomeRoute(routes, p));
    return [...HOME_PICKS.filter(([p]) => isHomeRoute(routes, p)), ...extra.map((p): [string, string] => [p, p])];
  }, [saved, site.live, site.history, routes]);
  const pa = cleanHomePath(a);
  const pb = test ? cleanHomePath(b) : null;
  const problem = !pa ? "Choose a landing page." : !isHomeRoute(routes, pa) ? "That page doesn't exist on this website yet. Choose an existing page."
    : test && (!pb || !isHomeRoute(routes, pb)) ? "Choose an existing page for Page B." : test && pa === pb ? "Pick two different pages." : "";
  const same = !problem && (test ? home.mode === "test" && liveA === pa && liveB === pb : home.mode === "path" && liveA === pa);
  const off = site.live?.disabledPages ?? [];
  const enabling = [pa, pb].filter((p): p is string => !!p && off.includes(p));

  const run = () => {
    if (problem || !pa) return;
    const key = home.mode === "test" && liveA === pa && liveB === pb ? home.key : `landing_hq_${Date.now()}`;
    const nextHome = test && pb
      ? { mode: "test" as const, key, arms: [{ id: "a", name: pa, page: { kind: "path" as const, path: pa } }, { id: "b", name: pb, page: { kind: "path" as const, path: pb } }] }
      : { mode: "path" as const, path: pa };
    const config = cleanConfig({ ...site.base(), home: nextHome, disabledPages: off.filter((p) => !enabling.includes(p)) });
    if (!config) { toast.error("That choice couldn't be saved."); return; }
    setPending({ title: test ? "Start this A/B test?" : "Change the homepage?", config,
      lines: [
        ...(test ? [`Half of visitors see ${pa}`, `The other half see ${pb}`, "Each visitor keeps the same version. Results appear in HQ → Results."]
          : [`Everyone visiting the homepage will see ${pa}.`, "No automatic A/B test will run."]),
        ...enabling.map((p) => `${p} will also be switched on.`),
      ] });
  };

  return (
    <GlassCard accent="green" className="p-5 space-y-4">
      <div><Eyebrow>Homepage</Eyebrow>
        {site.live === undefined ? <Skeleton className="mt-2 h-6" /> : <p className="mt-2 text-sm text-muted-foreground">Running now: <b className="text-foreground">{describeHome(home)}</b></p>}
      </div>
      <PageInput id="hq-page-a" value={a} onChange={setA} label={test ? "Page A" : "Landing page"} choices={choices} routes={routes} onAdd={add} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} className="h-4 w-4 accent-primary" />
        A/B test against another page
      </label>
      {test && <PageInput id="hq-page-b" value={b} onChange={setB} label="Page B" choices={choices} routes={routes} onAdd={add} />}
      {problem && <p role="status" className="text-sm text-destructive">{problem}</p>}
      {enabling.length > 0 && <p className="text-sm text-muted-foreground">This page is currently off. Applying your choice will switch it on.</p>}
      <Button disabled={site.live === undefined || !!problem || same} onClick={run} className="font-bold">
        <Rocket className="mr-2 h-4 w-4" />{same ? "Current homepage" : test ? "Apply A/B test…" : "Apply homepage…"}
      </Button>
    </GlassCard>
  );
}