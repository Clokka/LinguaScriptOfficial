import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard, Eyebrow, Skeleton } from "@/components/premium";
import { cleanConfig, DEFAULT_SITE, describeHome } from "@/lib/site/config";
import { configuredHomePaths, HOME_PICKS } from "@/lib/site/homepageChoices";
import { cleanHomePath, isHomeRoute, useHomeRoutes } from "@/lib/site/homeRoutes";
import { type Pending, type useSite } from "@/components/hq/useSite";

function PageInput({ id, value, onChange, label, choices }: {
  id: string; value: string; onChange: (value: string) => void;
  label: string; choices: [string, string][];
}) {
  const listed = choices.some(([path]) => path === value);
  const [custom, setCustom] = useState(false);
  const path = cleanHomePath(value);
  const adding = custom || (!!value && !listed);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <Select value={adding ? "custom" : value} onValueChange={(next) => {
        setCustom(next === "custom");
        onChange(next === "custom" ? "" : next);
      }}>
        <SelectTrigger id={id} className="h-12"><SelectValue placeholder="Choose a landing page" /></SelectTrigger>
        <SelectContent>
          {choices.map(([p, name]) => <SelectItem key={p} value={p}>{name} · {p}</SelectItem>)}
          <SelectItem value="custom">Add a page address…</SelectItem>
        </SelectContent>
      </Select>
      {adding && <Input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="/your-landing-page" aria-label={`${label} address`}
        className="font-mono" autoCapitalize="none" autoCorrect="off" spellCheck={false} />}
      {path && <Button asChild variant="ghost" size="sm"><a href={`${path}?hqpreview=1`} target="_blank" rel="noopener noreferrer">
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
  useEffect(() => { setA(liveA); setB(liveB); setTest(home.mode === "test"); }, [liveA, liveB, home.mode]);

  // Published custom addresses remain in the menu for the entire team.
  const choices = useMemo(() => {
    const paths = [a, b, ...configuredHomePaths(site.live?.home), ...site.history.flatMap((entry) => configuredHomePaths(entry.config.home))];
    const extra = Array.from(new Set(paths)).filter((p) => p && !HOME_PICKS.some(([known]) => known === p) && isHomeRoute(routes, p));
    return [...HOME_PICKS.filter(([p]) => isHomeRoute(routes, p)), ...extra.map((p): [string, string] => [p, p])];
  }, [a, b, site.live, site.history, routes]);
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
      <PageInput id="hq-page-a" value={a} onChange={setA} label={test ? "Page A" : "Landing page"} choices={choices} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} className="h-4 w-4 accent-primary" />
        A/B test against another page
      </label>
      {test && <PageInput id="hq-page-b" value={b} onChange={setB} label="Page B" choices={choices} />}
      {problem && <p role="status" className="text-sm text-destructive">{problem}</p>}
      {enabling.length > 0 && <p className="text-sm text-muted-foreground">This page is currently off. Applying your choice will switch it on.</p>}
      <Button disabled={site.live === undefined || !!problem || same} onClick={run} className="font-bold">
        <Rocket className="mr-2 h-4 w-4" />{same ? "Current homepage" : test ? "Apply A/B test…" : "Apply homepage…"}
      </Button>
    </GlassCard>
  );
}