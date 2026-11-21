// /hq — LinguaScript HQ: one place for the marketing team and AI engineers to
// see and change the website. Lazy route behind a role check (admin,
// marketer, engineer); visitors never download it.
//
//   Today       what visitors see now + "Which page is the homepage?" box:
//               type any address (/landing, /landing5…) and press Go live
//   Go live     intro, page and video loading screens, history with roll back.
//               Nothing changes until "OK, go live".
//   Results     homepage test numbers (AdminExperiments)
//   Partners    affiliates (admin + marketer only)
//   Every design all labs, real pages, loaders
//   Plans       marketing docs + notes for engineers
//   Team        HQ logins (admin only)
import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink, Eye, Rocket, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageLoading } from "@/components/PageLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, PremiumHeader, Eyebrow, Skeleton } from "@/components/premium";
import { cn } from "@/lib/utils";
import { PublishDialog, useSite, type Pending } from "@/components/hq/useSite";
import {
  BUILT_IN_LOADERS, DEFAULT_FILM_LOADER, DEFAULT_SITE, PAGE_LOADERS, cleanConfig, describeHome, describeLoader,
  writePreview, type FilmLoaderConfig, type SiteConfig,
} from "@/lib/site/config";
import { cleanHomePath } from "@/lib/site/homeRoutes";
import { HOME_PICKS } from "@/lib/site/homepageChoices";
import { HomepageBox } from "@/components/hq/HomepageBox";

const TeamTools = lazy(() => import("@/components/partners/TeamTools"));
const AdminExperiments = lazy(() => import("@/components/AdminExperiments").then((m) => ({ default: m.AdminExperiments })));
const IntroLoader = lazy(() => import("@/components/landing/IntroLoader"));
const FilmLoadingGate = lazy(() => import("@/components/FilmLoader").then((m) => ({ default: m.FilmLoadingGate })));
const AnimationsFrame = lazy(() => import("@/components/hq/AnimationsFrame"));
const SchoolEnquiries = lazy(() => import("@/components/hq/SchoolEnquiries"));

type Tab = "today" | "schools" | "animations" | "live" | "results" | "partners" | "library" | "docs" | "team";
const TABS: [Tab, string, string][] = [
  ["today", "🏠 Today", "What visitors see right now. Choose the landing page in the box below."],
  ["schools", "🏫 Schools", "School requests received from the website. Follow up and track your quotes."],
  ["animations", "🎬 Animations", "Build and pick the loading animations: the LinguaScript name intro, before a film, and the startup screen."],
  ["live", "🚀 Loading screens", "Pick the intro, page and video loading screens. Nothing changes until you press OK."],
  ["results", "📊 Results", "Which homepage gets more people to start. Wait for 1,000+ views per version before calling it."],
  ["partners", "🤝 Partners", "Affiliates: clicks, sign-ups, sales and payouts."],
  ["library", "🧪 Every design", "Every landing page and design lab. Tap to open."],
  ["docs", "📚 Plans", "The marketing plans, and notes for engineers."],
  ["team", "👥 Team", "Who has an HQ login. Give the marketing team and engineers their own."],
];

const LOADER_LABS: [string, string, number][] = [
  ["loading-screens", "Loading screens", 100],
  ["loading-motion", "Loading → playing motion", 30],
  ["loading-experiences", "Loading experiences", 12],
];
const LABS: [string, string, number, string][] = [
  ["design-lab", "Design Lab", 120, "Homepage templates: 10 colour themes × 12 layouts"],
  ["streaming-home", "Streaming Home", 108, "Streaming homepages with YouTube as the hub"],
  ["landing-demo", "Tap-a-Word Landing", 36, "Phone versions of the tap-a-word demo"],
  ["frequency-decks", "Frequency Decks", 44, "Top 50 → Top 3,000 deck section"],
  ["progress-page", "Progress Page", 30, "Comprehension 60% → 80%, rewatch gains"],
  ["app-screens", "App Screens", 72, "Onboarding, home, player, decks, gold, profile"],
  ["settings-profile", "Profile & Settings", 41, "Profile and settings, incl. social ideas"],
  ["glass-lab", "Glass Lab", 20, "Liquid glass, glassmorphism, morph motion"],
  ["style-atlas", "Style Atlas", 31, "28 visual + motion styles with search words"],
  ["motion-1", "Motion · Text & Cards", 30, "Text and card animations"],
  ["motion-2", "Motion · Video & Buttons", 33, "Hero, video and button animations"],
  ["motion-3", "Motion · Transitions", 41, "Transitions, backgrounds, easing"],
  ["loading-experiences", "Loading Experiences", 12, "Complete 10–30 s subtitle-wait experiences"],
  ["loading-screens", "Loading Screens", 100, "20 animations × 5 frame styles"],
  ["loading-motion", "Loading Motion", 30, "Loading-to-playing motion graphics"],
];
const DOCS: [string, string, string][] = [
  ["/brand/docs/marketing-audit.html", "Marketing audit", "SEO, buyer's journey page map, personas, funnel, email, 90-day plan"],
  ["/brand/docs/marketing-flowcharts.html", "Marketing flowcharts", "13 flowcharts: funnel, journey, emails, proof loop"],
  ["/brand/docs/growth-team.html", "Growth team blueprint", "Humans + AI agents, channels, tools"],
  ["/brand/docs/partner-programme.html", "Partner programme plan", "How partners, logins and payouts work"],
];
const DRIVE = "https://drive.google.com/drive/folders/1L7bFDi1OJJ6FE1xqjtH7sOkCK4mJbAE-";

export default function HQ() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    const h = window.location.hash.slice(1) as Tab;
    return TABS.some(([k]) => k === h) ? h : "today";
  });
  useEffect(() => { try { history.replaceState(null, "", `#${tab}`); } catch { /* ignore */ } }, [tab]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => setRoles(((data as { role: string }[]) ?? []).map((r) => r.role)));
  }, [user]);

  const isAdmin = !!roles?.includes("admin");
  const isMarketer = !!roles?.includes("marketer");
  const isTeam = isAdmin || isMarketer || !!roles?.includes("engineer");

  if (loading || (user && roles === null)) return <PageLoading />;
  if (!user) {
    return (
      <Shell onBack={() => navigate("/")}>
        <GlassCard className="p-8 text-center space-y-4">
          <h2 className="text-2xl font-black">LinguaScript HQ</h2>
          <p className="text-muted-foreground">Sign in with your team account.</p>
          <Button className="rounded-full" onClick={() => navigate("/auth?redirect=/hq")}>Sign in</Button>
        </GlassCard>
      </Shell>
    );
  }
  if (!isTeam) {
    return (
      <Shell onBack={() => navigate("/")}>
        <GlassCard className="p-8 text-center space-y-3">
          <h2 className="text-2xl font-black">HQ is for the LinguaScript team</h2>
          <p className="text-muted-foreground">Ask an admin for a marketing or engineer login.</p>
          {roles?.includes("partner") && <Button className="rounded-full" onClick={() => navigate("/partners")}>Go to your partner dashboard</Button>}
        </GlassCard>
      </Shell>
    );
  }

  const visible = TABS.filter(([k]) => (k === "partners" ? isAdmin || isMarketer : k === "team" ? isAdmin : true));
  return <HQBody tab={tab} setTab={setTab} visible={visible} isAdmin={isAdmin} roleLabel={isAdmin ? "ADMIN" : isMarketer ? "MARKETING" : "ENGINEER"} />;
}

function HQBody({ tab, setTab, visible, isAdmin, roleLabel }: {
  tab: Tab; setTab: (t: Tab) => void; visible: [Tab, string, string][]; isAdmin: boolean; roleLabel: string;
}) {
  const navigate = useNavigate();
  const site = useSite();
  const [days, setDays] = useState(30);
  const [pending, setPending] = useState<Pending | null>(null);
  return (
    <Shell onBack={() => navigate("/admin")} badge={roleLabel} wide={tab === "animations"}>
      <nav className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" aria-label="HQ sections">
        {visible.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}
            className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              tab === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">{visible.find(([k]) => k === tab)?.[2]}</p>

      <Suspense fallback={<Skeleton className="h-64" />}>
        {tab === "today" && <Today site={site} go={setTab} setPending={setPending} />}
        {tab === "schools" && <SchoolEnquiries />}
        {tab === "animations" && <AnimationsFrame site={site} />}
        {tab === "live" && <GoLive site={site} setPending={setPending} />}
        {tab === "results" && <GlassCard className="p-4"><AdminExperiments preferredKey={site.live?.home.mode === "test" ? site.live.home.key : undefined} /></GlassCard>}
        {tab === "partners" && (
          <TeamTools mode="team" isAdmin={isAdmin} days={days} setDays={setDays}
            onOpen={(id) => navigate(`/partners?view=${encodeURIComponent(id)}`)} />
        )}
        {tab === "library" && <Library />}
        {tab === "docs" && <Docs />}
        {tab === "team" && isAdmin && <Team />}
      </Suspense>
      <PublishDialog pending={pending} onClose={() => setPending(null)} publish={site.publish} />
    </Shell>
  );
}

function Shell({ children, onBack, badge, wide }: { children: React.ReactNode; onBack: () => void; badge?: string; wide?: boolean }) {
  return (
    <div className="ls-aurora min-h-screen bg-background">
      <PremiumHeader title="LinguaScript HQ" onBack={onBack}
        right={badge ? <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-emerald-300">{badge}</span> : null} />
      <main className={cn("mx-auto grid gap-4 px-4 py-6 sm:px-6", wide ? "max-w-[1600px]" : "max-w-5xl")}>{children}</main>
    </div>
  );
}

/* ───────────── Today ───────────── */
function summary(c: SiteConfig | null | undefined) {
  const s = c ?? DEFAULT_SITE;
  const home = describeHome(s.home);
  const intro = s.intro && s.intro.loader !== "none"
    ? `${describeLoader(s.intro.loader)} · ${s.intro.when === "always" ? "every visit" : s.intro.when === "first" ? "first visit only" : "once per visit"} · ${s.intro.end === "button" ? "waits for Enter" : "fades by itself"}`
    : "None";
  const f = s.filmLoader ?? DEFAULT_FILM_LOADER;
  const film = `${f.designs.length} design${f.designs.length === 1 ? "" : "s"} in rotation · ${f.reveals.length ? `${f.reveals.length} reveal motion${f.reveals.length === 1 ? "" : "s"}` : "no reveal"}${s.filmLoader ? "" : " (default)"}`;
  return { home, intro, page: PAGE_LOADERS[s.pageLoader ?? "skeleton"], film };
}

function Today({ site, go, setPending }: { site: ReturnType<typeof useSite>; go: (t: Tab) => void; setPending: (p: Pending) => void }) {
  const s = summary(site.live);
  const last = site.history[0];
  return (
    <div className="grid gap-4">
      <HomepageBox site={site} setPending={setPending} />
      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">Page availability</summary>
        <div className="mt-4"><PageSwitches site={site} setPending={setPending} /></div>
      </details>
      <GlassCard accent="green" className="p-5 space-y-3">
        <Eyebrow>Live on linguascript.co.uk</Eyebrow>
        {site.live === undefined ? <Skeleton className="h-20" /> : (
          <dl className="grid gap-2 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted-foreground">Homepage</dt><dd className="font-semibold">{s.home}</dd>
            <dt className="text-muted-foreground">Intro loading screen</dt><dd className="font-semibold">{s.intro}</dd>
            <dt className="text-muted-foreground">Page loading screen</dt><dd className="font-semibold">{s.page}</dd>
            <dt className="text-muted-foreground">Video loading screen</dt><dd className="font-semibold">{s.film}</dd>
            <dt className="text-muted-foreground">Last change</dt>
            <dd>{last ? `${new Date(last.created_at).toLocaleString()} by ${last.published_by_email ?? "someone"}${last.note ? ` · “${last.note}”` : ""}` : "Nothing published from HQ yet (the site runs its built-in setup)."}</dd>
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href="/for-schools" target="_blank" rel="noopener">Open the school sales page <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>
          <Button variant="default" size="sm" onClick={() => go("schools")}>School enquiries</Button>
          <a href="/?sitepreview=live" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm">See the live site <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </GlassCard>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {([
          ["animations", "🎬", "Animations", "Build the name intro, the screen before a film and the startup screen."],
          ["live", "🚀", "Loading screens", "Intro, page and video loading screens. Preview first."],
          ["results", "📊", "See what works", "Views, starts and sign-ups per homepage version."],
          ["library", "🧪", "Every design", "All 16 labs, the real pages and every loading screen."],
          ["docs", "📚", "Plans", "Marketing audit, flowcharts, growth team, partner plan."],
          ["partners", "🤝", "Partners", "Affiliates and their numbers."],
        ] as [Tab, string, string, string][]).map(([k, i, t, d]) => (
          <button key={k} onClick={() => go(k)} className="text-left">
            <GlassCard className="h-full p-4 transition hover:-translate-y-0.5">
              <div className="text-2xl">{i}</div>
              <p className="mt-2 font-bold">{t}</p>
              <p className="text-sm text-muted-foreground">{d}</p>
            </GlassCard>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Landing page on/off ───────────── */
// Switch pages off for a while: visitors who open them go to the homepage.
function PageSwitches({ site, setPending }: { site: ReturnType<typeof useSite>; setPending: (p: Pending) => void }) {
  const live = site.live;
  const off = live?.disabledPages ?? [];
  const home = live?.home.mode === "path" ? live.home.path : "";
  const [extra, setExtra] = useState("");
  const rows: [string, string][] = [...HOME_PICKS, ...off.filter((p) => !HOME_PICKS.some(([x]) => x === p)).map((p) => [p, p] as [string, string])];

  const save = (next: string[], line: string) => {
    const c = cleanConfig({ ...site.base(), disabledPages: next });
    if (c) setPending({ title: "Change which pages are on?", lines: [line], config: c });
  };
  const flip = (path: string, name: string) => off.includes(path)
    ? save(off.filter((p) => p !== path), `${name} (${path}) → ON`)
    : save([...off, path], `${name} (${path}) → OFF (visitors go to the homepage)`);
  const extraPath = cleanHomePath(extra);

  return (
    <GlassCard className="p-5 space-y-3">
      <div>
        <Eyebrow>🔌 Landing pages: on or off</Eyebrow>
        <p className="mt-1 text-sm text-muted-foreground">Switch a page <b>off</b> to hide it for a while. Anyone who opens it goes to the homepage instead. Switch it back <b>on</b> any time.</p>
      </div>
      {live === undefined ? <Skeleton className="h-40" /> : (
        <div className="divide-y divide-white/5">
          {rows.map(([path, name]) => {
            const isOff = off.includes(path);
            const isHome = path === home;
            return (
              <div key={path} className="flex items-center gap-3 py-2">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", isOff ? "bg-red-500" : "bg-emerald-400")} aria-hidden />
                <a href={`${path}?hqpreview=1`} target="_blank" rel="noopener" className="min-w-0 flex-1">
                  <b className={cn("text-sm", isOff && "text-muted-foreground line-through")}>{name}</b>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{path}</span>
                  {isHome && <span className="ml-2 text-xs font-semibold text-emerald-300">homepage</span>}
                </a>
                <button role="switch" aria-checked={!isOff} aria-label={`${name} ${isOff ? "off" : "on"}`}
                  disabled={isHome && !isOff} title={isHome ? "This is the homepage. Pick another homepage first." : undefined}
                  onClick={() => flip(path, name)}
                  className={cn("w-20 shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition disabled:opacity-40",
                    isOff ? "bg-red-500/20 text-red-300" : "bg-emerald-400 text-black")}>
                  {isOff ? "OFF" : "ON"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Another page, e.g. /landing6" className="max-w-xs font-mono" aria-label="Another page address" />
        <Button variant="outline" size="sm" disabled={!extraPath || off.includes(extraPath) || extraPath === home}
          onClick={() => { if (extraPath) { save([...off, extraPath], `${extraPath} → OFF (visitors go to the homepage)`); setExtra(""); } }}>Switch it off</Button>
      </div>
    </GlassCard>
  );
}

/* ───────────── Go live ───────────── */
function GoLive({ site, setPending }: { site: ReturnType<typeof useSite>; setPending: (p: Pending) => void }) {
  const start = site.live ?? DEFAULT_SITE;
  const [intro, setIntro] = useState(start.intro ?? DEFAULT_SITE.intro!);
  const [pageLoader, setPageLoader] = useState(start.pageLoader ?? "skeleton");
  const [playing, setPlaying] = useState(false);
  const [film, setFilm] = useState<FilmLoaderConfig>(start.filmLoader ?? DEFAULT_FILM_LOADER);

  // When the live config arrives after first render, start from it.
  useEffect(() => {
    if (!site.live) return;
    const l = site.live;
    if (l.intro) setIntro(l.intro);
    setPageLoader(l.pageLoader ?? "skeleton");
    setFilm(l.filmLoader ?? DEFAULT_FILM_LOADER);
  }, [site.live?.published_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The homepage is changed on the Today tab; this keeps whatever is live.
  const build = (): SiteConfig | null => cleanConfig({ ...start, intro, pageLoader, filmLoader: film });

  const goLive = () => {
    const c = build();
    if (!c) { toast.error("Something isn't set yet."); return; }
    const s = summary(c);
    setPending({ title: "Change the live website?", lines: [`Intro loading screen → ${s.intro}`, `Page loading screen → ${s.page}`, `Video loading screen → ${s.film}`], config: c });
  };
  const preview = (c: SiteConfig | null = build()) => {
    if (!c) { toast.error("Something isn't set yet."); return; }
    writePreview(c);
    window.open("/?sitepreview=1", "_blank", "noopener");
  };

  const labOf = intro.loader.startsWith("lab:") ? intro.loader.split(":")[1] : "";
  const numOf = intro.loader.startsWith("lab:") ? Number(intro.loader.split(":")[2]) : 0;
  const labMax = LOADER_LABS.find(([k]) => k === labOf)?.[2] ?? 1;
  const setLabNum = (n: number) => setIntro({ ...intro, loader: `lab:${labOf}:${(n + labMax) % labMax}` });

  return (
    <div className="grid gap-4">
      <GlassCard className="p-5 space-y-3">
        <Eyebrow>1 · Intro loading screen</Eyebrow>
        <p className="text-sm text-muted-foreground">Plays over the homepage before it shows. Visitors can always skip it.</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(BUILT_IN_LOADERS).map(([k, n]) => (
            <Chip key={k} on={intro.loader === k} onClick={() => setIntro({ ...intro, loader: k })}>{n}</Chip>
          ))}
          {LOADER_LABS.map(([k, n, max]) => (
            <Chip key={k} on={labOf === k} onClick={() => setIntro({ ...intro, loader: `lab:${k}:0` })}>{n} ({max})</Chip>
          ))}
        </div>
        {labOf && (
          <div className="grid gap-2 sm:grid-cols-[1fr_320px] items-start">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setLabNum(numOf - 1)} aria-label="Previous design">◀</Button>
              <span className="font-mono text-sm">Design #{numOf + 1} of {labMax}</span>
              <Button size="sm" variant="outline" onClick={() => setLabNum(numOf + 1)} aria-label="Next design">▶</Button>
              <Input type="number" min={1} max={labMax} value={numOf + 1} onChange={(e) => setLabNum(Math.max(1, Math.min(labMax, Number(e.target.value) || 1)) - 1)} className="w-20" />
            </div>
            <iframe title="Loading screen preview" src={`/brand/${labOf}.html#only=${numOf}`} loading="lazy"
              className="h-[200px] w-full rounded-xl border border-white/10 bg-black" />
          </div>
        )}
        {intro.loader !== "none" && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <select className="rounded-md border border-white/10 bg-transparent px-2 py-1.5" value={intro.when} onChange={(e) => setIntro({ ...intro, when: e.target.value as typeof intro.when })} aria-label="When it plays">
              <option value="session">Once per visit</option><option value="first">First visit only</option><option value="always">Every time</option>
            </select>
            <select className="rounded-md border border-white/10 bg-transparent px-2 py-1.5" value={intro.end} onChange={(e) => setIntro({ ...intro, end: e.target.value as typeof intro.end })} aria-label="How it ends">
              <option value="auto">Fades by itself</option><option value="button">Waits for “Enter LinguaScript”</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => setPlaying(true)}>▶ Play it here</Button>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <Eyebrow>2 · Page loading screen</Eyebrow>
        <p className="text-sm text-muted-foreground">Shows for a moment while any page opens.</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PAGE_LOADERS).map(([k, n]) => (
            <Chip key={k} on={pageLoader === k} onClick={() => setPageLoader(k as typeof pageLoader)}>{n}</Chip>
          ))}
        </div>
      </GlassCard>

      <FilmLoaderPicker film={film} setFilm={setFilm} />

      <div className="sticky bottom-3 z-10 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-background/80 p-3 backdrop-blur-xl">
        <Button variant="outline" onClick={() => preview()}><Eye className="mr-1 h-4 w-4" /> Preview in a new tab</Button>
        <Button className="ml-auto bg-gradient-to-r from-green-500 to-yellow-400 font-bold text-black" onClick={goLive}><Rocket className="mr-1 h-4 w-4" /> Go live…</Button>
      </div>

      <GlassCard className="p-5 space-y-2">
        <Eyebrow>History</Eyebrow>
        {site.history.length === 0 ? <p className="text-sm text-muted-foreground">Nothing published yet.</p> : site.history.map((h, i) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
            <span className="flex-1 min-w-[200px]">{summary(h.config).home}{h.note ? <i className="text-muted-foreground"> · “{h.note}”</i> : null}
              <span className="text-muted-foreground"> · {h.published_by_email ?? "someone"}</span>{i === 0 && <b className="ml-2 text-emerald-400">LIVE</b>}</span>
            <Button size="sm" variant="ghost" onClick={() => preview(cleanConfig(h.config))}><Eye className="h-4 w-4" /></Button>
            {i > 0 && <Button size="sm" variant="outline" onClick={() => {
              const c = cleanConfig(h.config);
              if (c) setPending({ title: "Roll back to this version?", lines: [`Homepage → ${summary(c).home}`, `Intro → ${summary(c).intro}`], config: c, note: `Roll back to #${h.id}` });
            }}><RotateCcw className="mr-1 h-4 w-4" /> Roll back</Button>}
          </div>
        ))}
      </GlassCard>

      {playing && (
        <Suspense fallback={null}>
          <IntroLoader loader={intro.loader} end={intro.end} onDone={() => setPlaying(false)} />
        </Suspense>
      )}
    </div>
  );
}

/* ───────────── Video loading screens ───────────── */
const FILM_LABS: [string, string, number][] = [["loading-screens", "Loading screens", 100], ["loading-experiences", "Loading experiences", 12]];
const labelOfId = (id: string) => (id === "chameleon" ? "Chameleon Method screen" : id.startsWith("decode:") ? `Decode · ${id.slice(7)}` : `${id.split(":")[1].replace("loading-", "")} #${Number(id.split(":")[2]) + 1}`);

function FilmLoaderPicker({ film, setFilm }: { film: FilmLoaderConfig; setFilm: (f: FilmLoaderConfig) => void }) {
  const [lab, setLab] = useState("loading-screens");
  const [n, setN] = useState(0);
  const [m, setM] = useState(0);
  const [demo, setDemo] = useState<null | { ready: boolean; key: number }>(null);
  const max = FILM_LABS.find(([k]) => k === lab)?.[2] ?? 1;
  const cand = `lab:${lab}:${n}`;
  const motion = `lab:loading-motion:${m}`;
  const toggle = (key: "designs" | "reveals", id: string) =>
    setFilm({ ...film, [key]: film[key].includes(id) ? film[key].filter((x) => x !== id) : [...film[key], id] });
  const play = () => {
    const k = Date.now();
    setDemo({ ready: false, key: k });
    setTimeout(() => setDemo((d) => (d && d.key === k ? { ...d, ready: true } : d)), 4500);
    setTimeout(() => setDemo((d) => (d && d.key === k ? null : d)), 4500 + 2400);
  };
  return (
    <GlassCard className="p-5 space-y-4">
      <Eyebrow>3 · Video loading screens</Eyebrow>
      <p className="text-sm text-muted-foreground">While a film's subtitles load, the player shows these one after another, round and round (default: the “Through the languages → LinguaScript” decoder, then the Chameleon Method screen). Lab designs show the real progress as their caption. When the subtitles are ready, one “loading → playing” motion plays.</p>

      <div className="space-y-2">
        <p className="text-sm font-semibold">While loading · {film.designs.length} in rotation</p>
        <div className="flex flex-wrap gap-1.5">
          {film.designs.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              {labelOfId(id)}<button aria-label={`Remove ${labelOfId(id)}`} onClick={() => toggle("designs", id)}>✕</button>
            </span>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_320px] items-start">
          <div className="flex flex-wrap items-center gap-2">
            {FILM_LABS.map(([k, name]) => <Chip key={k} on={lab === k} onClick={() => { setLab(k); setN(0); }}>{name}</Chip>)}
            <Button size="sm" variant="outline" onClick={() => setN((n - 1 + max) % max)} aria-label="Previous design">◀</Button>
            <span className="font-mono text-sm">#{n + 1} of {max}</span>
            <Button size="sm" variant="outline" onClick={() => setN((n + 1) % max)} aria-label="Next design">▶</Button>
            <Button size="sm" onClick={() => toggle("designs", cand)}>{film.designs.includes(cand) ? "✕ Remove" : "＋ Add to rotation"}</Button>
            <Button size="sm" variant="ghost" onClick={() => toggle("designs", "chameleon")}>{film.designs.includes("chameleon") ? "✕ Chameleon Method screen" : "＋ Chameleon Method screen"}</Button>
            {(["languages", "decode", "deck"] as const).map((k) => (
              <Button key={k} size="sm" variant="ghost" onClick={() => toggle("designs", `decode:${k}`)}>{film.designs.includes(`decode:${k}`) ? "✕" : "＋"} Decode · {k}</Button>
            ))}
          </div>
          <iframe title="Loading design preview" src={`/brand/${lab}.html#only=${n}`} loading="lazy" className="h-[180px] w-full rounded-xl border border-white/10 bg-black" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">When ready (loading → playing) · {film.reveals.length ? `${film.reveals.length} in rotation` : "none, straight in"}</p>
        <div className="flex flex-wrap gap-1.5">
          {film.reveals.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
              motion #M{String(Number(id.split(":")[2]) + 1).padStart(2, "0")}<button aria-label="Remove motion" onClick={() => toggle("reveals", id)}>✕</button>
            </span>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_320px] items-start">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setM((m + 29) % 30)} aria-label="Previous motion">◀</Button>
            <span className="font-mono text-sm">#M{String(m + 1).padStart(2, "0")} of 30</span>
            <Button size="sm" variant="outline" onClick={() => setM((m + 1) % 30)} aria-label="Next motion">▶</Button>
            <Button size="sm" onClick={() => toggle("reveals", motion)}>{film.reveals.includes(motion) ? "✕ Remove" : "＋ Add to rotation"}</Button>
          </div>
          <iframe title="Motion preview" src={`/brand/loading-motion.html#only=${m}`} loading="lazy" className="h-[180px] w-full rounded-xl border border-white/10 bg-black" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={play} disabled={!film.designs.length}>▶ Try it like a real video</Button>
        <Button size="sm" variant="ghost" onClick={() => setFilm(DEFAULT_FILM_LOADER)}>↺ Back to the default</Button>
      </div>
      {demo && (
        <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-black" style={{ aspectRatio: "16 / 9" }}>
          <div className="absolute inset-0 grid place-items-center text-white/80 text-lg font-bold">▶ The film plays here</div>
          <Suspense fallback={null}>
            <FilmLoadingGate key={demo.key} config={film} ready={demo.ready} status={demo.ready ? "Ready" : "Downloading French & English captions…"} onComplete={() => {}} duration={60000}>
              {null}
            </FilmLoadingGate>
          </Suspense>
        </div>
      )}
      {!film.designs.length && <p className="text-sm text-amber-300">Add at least one design, or the player uses the default.</p>}
    </GlassCard>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", on ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/10 text-foreground hover:border-white/30")}>
      {children}
    </button>
  );
}

/* ───────────── Every design ───────────── */
function Library() {
  return (
    <div className="grid gap-4">
      <Eyebrow>Landing pages ({HOME_PICKS.length})</Eyebrow>
      <p className="text-sm text-muted-foreground">To make one the homepage, type its address in the box on the <b>Today</b> tab.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {HOME_PICKS.map(([path, n]) => (
          <a key={path} href={path} target="_blank" rel="noopener"><GlassCard className="p-3 text-sm hover:-translate-y-0.5 transition"><b>{n} ↗</b><p className="font-mono text-xs text-muted-foreground">{path}</p></GlassCard></a>
        ))}
      </div>
      <Eyebrow>Design labs ({LABS.length})</Eyebrow>
      <div className="grid gap-2 sm:grid-cols-2">
        {LABS.map(([k, n, c, d]) => (
          <a key={k} href={`/brand/${k}.html`} target="_blank" rel="noopener">
            <GlassCard className="p-3 hover:-translate-y-0.5 transition">
              <p className="font-semibold">{n}{c ? <span className="ml-2 font-mono text-xs text-muted-foreground">{c}</span> : null} ↗</p>
              <p className="text-xs text-muted-foreground">{d}</p>
            </GlassCard>
          </a>
        ))}
      </div>
      <Eyebrow>Intro loaders (4 decoding + 142 designs)</Eyebrow>
      <p className="text-sm text-muted-foreground">{Object.values(BUILT_IN_LOADERS).slice(1).join(" · ")}. Pick and play them in <b>Go live → Intro loading screen</b>.</p>
    </div>
  );
}

/* ───────────── Plans ───────────── */
function Docs() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {DOCS.map(([href, t, d]) => (
          <a key={href} href={href} target="_blank" rel="noopener">
            <GlassCard className="p-4 hover:-translate-y-0.5 transition"><p className="font-semibold">{t} ↗</p><p className="text-xs text-muted-foreground">{d}</p></GlassCard>
          </a>
        ))}
        <a href={DRIVE} target="_blank" rel="noopener">
          <GlassCard className="p-4 hover:-translate-y-0.5 transition"><p className="font-semibold">Google Drive · Linguascript folder ↗</p><p className="text-xs text-muted-foreground">Photos, videos, brand assets, HTML copies (needs Drive access)</p></GlassCard>
        </a>
      </div>
      <GlassCard className="p-5 space-y-2 text-sm">
        <Eyebrow>For engineers</Eyebrow>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>What's live</b> = newest row of <code>site_publishes</code>; the homepage reads it with <code>get_live_site()</code> (<code>src/lib/site/config.ts</code>, cached 10 min on the device).</li>
          <li><b>Homepage</b>: HQ stores <code>{'{ mode: "path", path: "/landing" }'}</code>; <code>src/components/landing/LiveHome.tsx</code> renders that route from App.tsx's <code>APP_ROUTES</code> at “/” (unknown address → built-in test). New landing page = add a route in App.tsx, then type its address in HQ.</li>
          <li><b>Loaders</b>: intro = <code>IntroLoader.tsx</code>; page loader = <code>PageLoading.tsx</code> (reads <code>ls.site.pageLoader</code>).</li>
          <li><b>Rules</b>: AGENTS.md (speed: first-load bundle stays small; consent before trackers; one review ladder).</li>
          <li><b>Roles</b>: admin · marketer · engineer (HQ) · partner (/partners). Admins give logins in Team.</li>
        </ul>
      </GlassCard>
    </div>
  );
}

/* ───────────── Team ───────────── */
function Team() {
  const [rows, setRows] = useState<{ email: string; roles: string[] }[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("marketer");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data, error } = await (supabase as any).rpc("admin_team_members");
    if (error) { toast.error(error.message); setRows([]); return; }
    setRows(data ?? []);
  };
  useEffect(() => { void load(); }, []);
  const set = async (grant: boolean, who = email, r = role) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_set_team_role", { _email: who.trim(), _role: r, _grant: grant });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(grant ? "Login given" : "Login removed");
    setEmail(""); void load();
  };
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <GlassCard className="p-4">
        {rows === null ? <Skeleton className="h-32" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No team yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr><th className="pb-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</th><th className="pb-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Roles</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.email} className="border-t border-white/5">
                <td className="py-2">{r.email}</td>
                <td className="py-2 space-x-1">{r.roles.map((x) => (
                  <span key={x} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">{x}
                    {x !== "admin" && <button aria-label={`Remove ${x}`} disabled={busy} onClick={() => { if (confirm(`Remove ${x} from ${r.email}?`)) void set(false, r.email, x); }}>✕</button>}
                  </span>
                ))}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </GlassCard>
      <GlassCard className="p-4 space-y-2">
        <Eyebrow>Give a login</Eyebrow>
        <p className="text-xs text-muted-foreground">They sign up on linguascript.co.uk first, then you add them here.</p>
        <Input placeholder="Their account email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="w-full rounded-md border border-white/10 bg-background px-2 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="marketer">Marketing team: HQ + partners, no payouts</option>
          <option value="engineer">Engineer: HQ, no partner money</option>
          <option value="partner">Partner: their own dashboard only</option>
        </select>
        <Button className="w-full" disabled={busy || !email} onClick={() => set(true)}>Give login</Button>
      </GlassCard>
    </div>
  );
}
