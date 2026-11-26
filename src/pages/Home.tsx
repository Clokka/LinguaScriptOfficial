// /home — the signed-in learner's home: the website as a "remote control"
// (docs/plans/linguascript-builder.md). Watching happens in the extension and
// the app; this page shows, in 5 seconds: the one next step (gold reviews or
// "watch something"), the real % of film & TV words that are yours (same
// counts as the extension), the decks, and whether the extension is connected.
// Three tabs for now: Today · Words · Me (LinguaScripts parked, 26 Nov).
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, Eyebrow, Skeleton } from "@/components/premium";
import { Seo } from "@/components/Seo";
import { PageLoading } from "@/components/PageLoading";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import { isDueGold, isBlue, normalizeToken } from "@/lib/vocab";
import { loadShares, filmCoverage, type FilmCoverage } from "@/lib/filmCoverage";
import { isInApp } from "@/components/AppWelcome";
import { AppTabs } from "@/components/AppTabs";

interface Row { word: string; state: string; next_review: string | null; interval_days: number | null; state_changed_at: string | null; created_at: string | null; green_revealed_at?: string | null }
interface Counts { red: number; orange: number; green: number; gold: number; blue: number }
const COLS = "word, state, next_review, interval_days, state_changed_at, created_at, green_revealed_at";
const pct = (n: number) => `${n >= 10 || n === 0 ? n.toFixed(0) : n.toFixed(1)}%`;
const DECK = { red: "#FF3B30", orange: "#FF8A00", green: "#34C759", gold: "#FFD54A", blue: "#4DA3FF" } as const;

async function loadRows(userId: string, lang: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const page = (cols: string) => supabase.from("saved_words").select(cols).eq("user_id", userId).eq("language", lang)
      .order("created_at", { ascending: false }).range(from, from + 999) as unknown as Promise<{ data: unknown[] | null; error: unknown }>;
    let { data, error } = await page(COLS);
    if (error) ({ data, error } = await page(COLS.replace(", green_revealed_at", ""))); // older databases have no green_revealed_at
    if (error || !data) break;
    out.push(...(data as unknown as Row[]));
    if (data.length < 1000) break;
  }
  return out;
}

/** The extension answers the site's "hello" (extension/site-bridge.js). */
function useExtensionConnected(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.source === window && e.data?.source === "ls-extension") setOn(true); };
    addEventListener("message", onMsg);
    window.postMessage({ source: "ls-site", type: "hello" }, location.origin);
    const t = setTimeout(() => setOn((v) => v ?? false), 1500);
    return () => { removeEventListener("message", onMsg); clearTimeout(t); };
  }, []);
  return on;
}

export default function Home() {
  const { user, loading } = useAuth();
  const { learningLanguage } = useLanguage();
  const lang = (learningLanguage || "es").toLowerCase();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cov, setCov] = useState<FilmCoverage | null>(null);
  const extension = useExtensionConnected();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setName(String((data as { display_name?: string } | null)?.display_name || "").split(/[@\s]/)[0]));
    setRows(null); setCov(null);
    loadRows(user.id, lang).then(async (r) => {
      setRows(r);
      const shares = await loadShares(lang);
      if (shares) setCov(filmCoverage(shares, r.map((x) => ({ ...x, gold: isDueGold(x as any) }))));
    });
  }, [user, lang]);

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/" replace />;
  const counts: Counts = { red: 0, orange: 0, green: 0, gold: 0, blue: 0 };
  const seen = new Set<string>();
  for (const r of rows || []) {
    const k = normalizeToken(r.word);
    if (seen.has(k)) continue; seen.add(k);
    if (isDueGold(r as any)) counts.gold++;
    else if (isBlue(r as any)) counts.blue++;
    else if (r.state === "green") counts.green++;
    else if (r.state === "orange") counts.orange++;
    else counts.red++;
  }
  const last = rows?.[0];
  const next = counts.gold > 0
    ? { title: `✨ ${counts.gold} gold word${counts.gold === 1 ? "" : "s"} ready`, sub: "A 1-minute review keeps them green", label: "Review", to: `/flashcards?deck=gold&lang=${lang}` }
    : counts.red + counts.orange > 0
      ? { title: `🃏 ${counts.red + counts.orange} words to practise`, sub: "Turn red and orange words green", label: "Practise", to: `/flashcards?lang=${lang}` }
      : { title: "🎬 Watch something you love", sub: "Tap words in the subtitles to save them", label: "Watch", to: "/discover" };

  return (
    <div className="ls-aurora min-h-screen bg-background pb-24">
      <Seo title="Today" description="Your LinguaScript home." path="/home" noindex />
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-5 sm:px-6">
        <Link to="/home" className="flex items-center gap-2 text-lg font-extrabold">
          <img src="/logo.svg" alt="" className="h-7 w-auto" /><span>Lingua<span className="text-emerald-400">Script</span></span>
        </Link>
        <Link to="/profile" className="text-sm text-muted-foreground">{getLanguageFlag(lang)} {getLanguageLabel(lang)}</Link>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold">Hi{name ? ` ${name}` : ""} 👋</h1>
          {last && <p className="mt-1 text-sm text-muted-foreground">Last saved: <b className="text-foreground" translate="no">{last.word}</b></p>}
        </div>

        {rows === null ? <Skeleton className="h-24 w-full" /> : (
          <GlassCard glow className="flex items-center justify-between gap-3 p-5">
            <div><p className="text-lg font-extrabold">{next.title}</p><p className="mt-1 text-sm text-muted-foreground">{next.sub}</p></div>
            <Link to={next.to} className="inline-flex h-11 shrink-0 items-center rounded-full bg-emerald-500 px-5 font-extrabold text-black">{next.label}</Link>
          </GlassCard>
        )}

        {cov ? (
          <GlassCard className="p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-5xl font-black tracking-tight text-emerald-400">{pct(cov.known)}</span>
              <span className="text-sm text-muted-foreground">of {getLanguageLabel(lang)} film &amp; TV words are yours
                {cov.weekGain >= 0.05 && <b className="text-emerald-400"> · +{pct(cov.weekGain)} this week</b>}</span>
            </div>
            <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <i className="absolute inset-y-0 left-0 rounded-full bg-orange-500/45" style={{ width: `${cov.decks}%` }} />
              <i className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${cov.known}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>0</span><span>50%</span><span>75%</span><span>90%</span></div>
            {cov.decks - cov.known >= 0.1 && <p className="mt-2 text-xs text-muted-foreground">+{pct(cov.decks - cov.known)} more in your red &amp; orange words: review them to turn them green.</p>}
          </GlassCard>
        ) : rows !== null && <Skeleton className="h-32 w-full" />}

        {rows !== null && (
          <GlassCard className="p-5">
            <Eyebrow>Your decks</Eyebrow>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center">
              {(Object.keys(counts) as (keyof Counts)[]).map((k) => (
                <Link key={k} to={`/flashcards?deck=${k === "blue" ? "green" : k}&lang=${lang}`} className="rounded-xl bg-white/5 py-2">
                  <span className="block text-lg font-extrabold" style={{ color: DECK[k] }}>{counts[k]}</span>
                  <span className="text-[11px] capitalize text-muted-foreground">{k}</span>
                </Link>
              ))}
            </div>
          </GlassCard>
        )}

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {extension === true && <span>Extension <b className="text-emerald-400">✓ connected</b></span>}
          {extension === false && !isInApp() && <a className="underline" href="https://chromewebstore.google.com/detail/linguascript-learn-langua/pdooaedahecfoajjgjkmfeejffipfjfe" target="_blank" rel="noopener noreferrer">Get the Chrome extension</a>}
          {isInApp() && <span>Phone app <b className="text-emerald-400">✓ connected</b></span>}
        </p>
      </main>
      <AppTabs />
    </div>
  );
}
