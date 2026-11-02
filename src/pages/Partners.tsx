// /partners — LinguaScript Partners + growth team workspace.
//
//   partner  → their own numbers only (partner_dashboard: totals, groups < 5 hidden)
//   marketer → every partner's numbers + Site Studio (no learner data, no payouts)
//   admin    → everything, plus add partners, team roles, approve and pay
//
// Lazy-loaded route: visitors never download it (AGENTS.md "Visitors never
// download design/admin tooling"). Every tab opens with one sentence.
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageLoading } from "@/components/PageLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, PremiumHeader, Eyebrow, CountUp, Skeleton } from "@/components/premium";
import { cn } from "@/lib/utils";

const TeamTools = lazy(() => import("@/components/partners/TeamTools"));

type Dash = {
  partner: { id: string; code: string; display_name: string; socials: Record<string, string>; brand_logo_url: string | null;
    logo_approved: boolean; commission_rate: number; commission_months: number; status: string; has_payout_details: boolean };
  days: number; clicks: number; visitors: number; signups: number; activated: number; paid: number;
  channels: { channel: string; clicks: number; signups: number }[];
  devices: { device: string; clicks: number }[];
  regions: { region: string; clicks: number }[];
  earnings: { pending: number; approved: number; paid: number; next_available: string | null };
  months: { month: string; earned: number; sales: number }[];
  payouts: { date: string; amount: number; method: string }[];
};

export const money = (minor: number) => `£${(minor / 100).toFixed(2)}`;
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "–");
const CHANNELS = ["tiktok", "instagram", "youtube", "x", "podcast", "other"];

const PARTNER_TABS = [
  ["home", "Home", "How your audience moves from your link to paying."],
  ["links", "My links", "Pick where you'll post; the link tags itself so you can compare channels."],
  ["audience", "Audience", "Where your visitors came from. Groups smaller than 5 people are shown as “other”."],
  ["pages", "Landing pages", "What your audience sees when they arrive. View only."],
  ["new", "What's new", "Features you can talk about today."],
  ["brand", "Brand kit", "Logo, colours and the rules for posting."],
  ["payouts", "Payouts", "What you've earned, what's on hold, and what's been paid."],
  ["profile", "Profile", "Your name, socials, logo and where we send your money."],
  ["rules", "Rules", "The short version of the partner terms."],
] as const;
type Tab = (typeof PARTNER_TABS)[number][0] | "team" | "studio";

export default function Partners() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  // team: which partner (HQ → Partners opens /partners?view=<id>)
  const [viewing, setViewing] = useState<string | null>(() => new URLSearchParams(window.location.search).get("view"));
  const [days, setDays] = useState(30);
  const [dash, setDash] = useState<Dash | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setRoles(((data as { role: string }[]) ?? []).map((r) => r.role));
    })();
  }, [user]);

  const isAdmin = !!roles?.includes("admin");
  const isTeam = isAdmin || !!roles?.includes("marketer");
  const isPartner = !!roles?.includes("partner");

  useEffect(() => { if (roles && isTeam && !isPartner) setTab((t) => (t === "home" && !viewing ? "team" : t)); }, [roles, isTeam, isPartner, viewing]);

  const load = useCallback(async () => {
    if (!roles || (!isPartner && !viewing)) { setDash(null); return; }
    setDash(undefined);
    const { data, error } = await (supabase as any).rpc("partner_dashboard", { _partner_id: viewing, _days: days });
    if (error) { console.error(error); setDash(null); return; }
    setDash((data as Dash) ?? null);
  }, [roles, isPartner, viewing, days]);
  useEffect(() => { void load(); }, [load]);

  if (loading || (user && roles === null)) return <PageLoading />;

  if (!user) {
    return (
      <Shell onBack={() => navigate("/")}>
        <GlassCard className="p-8 text-center space-y-4">
          <h2 className="text-2xl font-black">LinguaScript Partners</h2>
          <p className="text-muted-foreground">Sign in with the account you were invited with.</p>
          <Button className="rounded-full" onClick={() => navigate("/auth?redirect=/partners")}>Sign in</Button>
        </GlassCard>
      </Shell>
    );
  }

  if (!isPartner && !isTeam) {
    return (
      <Shell onBack={() => navigate("/")}>
        <GlassCard className="p-8 text-center space-y-3">
          <h2 className="text-2xl font-black">This area is for LinguaScript partners</h2>
          <p className="text-muted-foreground">Want to recommend LinguaScript and earn from it? Email the team and we'll set you up.</p>
          <p className="font-mono text-sm select-all">rowan@linguascript.co.uk</p>
        </GlassCard>
      </Shell>
    );
  }

  const tabs: [Tab, string][] = [
    ...(isTeam ? ([["team", "All partners"], ["studio", "Site Studio"]] as [Tab, string][]) : []),
    ...((isPartner || viewing) ? PARTNER_TABS.map(([k, l]) => [k, l] as [Tab, string]) : []),
  ];
  const sentence = tab === "team" ? "Every partner at a glance. Tap one to see their dashboard."
    : tab === "studio" ? "Mix the site's designs and test versions. Changes here don't touch the live site."
    : PARTNER_TABS.find(([k]) => k === tab)?.[2];

  return (
    <Shell onBack={() => navigate("/")} badge={isAdmin ? "ADMIN" : isTeam ? "TEAM" : "PARTNER"}>
      <nav className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Partner sections">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              tab === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </nav>
      {viewing && tab !== "team" && tab !== "studio" && dash && (
        <p className="text-xs text-muted-foreground">Viewing <b className="text-foreground">{dash.partner.display_name || dash.partner.code}</b> as the team. <button className="underline" onClick={() => { setViewing(null); setTab("team"); }}>Back to all partners</button></p>
      )}
      <p className="text-sm text-muted-foreground">{sentence}</p>

      {(tab === "team" || tab === "studio") ? (
        <Suspense fallback={<Skeleton className="h-64" />}>
          <TeamTools mode={tab} isAdmin={isAdmin} days={days} setDays={setDays}
            onOpen={(id) => { setViewing(id); setTab("home"); }} />
        </Suspense>
      ) : dash === undefined ? (
        <div className="grid gap-3"><Skeleton className="h-28" /><Skeleton className="h-48" /></div>
      ) : dash === null ? (
        <GlassCard className="p-6 text-sm text-muted-foreground">No partner profile is linked to this account yet. Ask the team to finish setting you up.</GlassCard>
      ) : (
        <PartnerView tab={tab} dash={dash} days={days} setDays={setDays} reload={load} isTeam={isTeam} isAdmin={isAdmin} />
      )}
    </Shell>
  );
}

function Shell({ children, onBack, badge }: { children: React.ReactNode; onBack: () => void; badge?: string }) {
  return (
    <div className="ls-aurora min-h-screen bg-background">
      <PremiumHeader title="LinguaScript Partners" onBack={onBack}
        right={badge ? <span className="rounded-full bg-amber-400/15 px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-amber-300">{badge}</span> : null} />
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

function DaysPicker({ days, setDays }: { days: number; setDays: (d: number) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Period">
      {[7, 30, 90, 365].map((d) => (
        <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
          className={cn("rounded-full px-3 py-1 text-xs font-semibold", days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
          {d === 365 ? "1 year" : `${d} days`}
        </button>
      ))}
    </div>
  );
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast("Select the link and copy it"); }
}

function PartnerView({ tab, dash, days, setDays, reload, isTeam, isAdmin }: {
  tab: Tab; dash: Dash; days: number; setDays: (d: number) => void; reload: () => void; isTeam: boolean; isAdmin: boolean;
}) {
  const e = dash.earnings;
  const earned = e.pending + e.approved + e.paid;
  const [ch, setCh] = useState("tiktok");
  const link = `${window.location.origin}/r/${dash.partner.code}?ch=${ch}`;

  if (tab === "home") {
    const steps = [
      ["Clicked", dash.clicks, "#3fa9ff"], ["Signed up", dash.signups, "#FF9F0A"],
      ["Saved 10 words", dash.activated, "#a3e635"], ["Paid", dash.paid, "#34C759"],
    ] as const;
    return (
      <div className="grid gap-4">
        <div className="flex justify-end"><DaysPicker days={days} setDays={setDays} /></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label={`CLICKS · ${days}D`} value={dash.clicks} sub={`${dash.visitors} people`} />
          <Kpi label="SIGN-UPS" value={dash.signups} sub={`${pct(dash.signups, dash.visitors)} of people`} />
          <Kpi label="PAID" value={dash.paid} sub={`${pct(dash.paid, dash.signups)} of sign-ups`} />
          <GlassCard accent="gold" glow className="p-4">
            <Eyebrow className="text-[9px]">EARNED · ALL TIME</Eyebrow>
            <p className="mt-1 text-2xl font-black text-amber-300">{money(earned)}</p>
            <p className="text-xs text-muted-foreground">{money(e.approved)} ready to pay</p>
          </GlassCard>
        </div>
        <GlassCard className="grid gap-2 p-5">
          <h3 className="font-bold">Your funnel</h3>
          {steps.map(([l, n, c]) => (
            <div key={l} className="grid grid-cols-[110px_1fr_56px] items-center gap-3 text-sm">
              <span>{l}</span>
              <span className="h-3 overflow-hidden rounded-full bg-white/10">
                <i className="block h-full rounded-full transition-[width] duration-1000" style={{ width: `${dash.clicks ? Math.max(1.5, (n / Math.max(1, steps[0][1])) * 100) : 0}%`, background: c }} />
              </span>
              <b className="text-right tabular-nums">{n.toLocaleString()}</b>
            </div>
          ))}
        </GlassCard>
        {dash.clicks === 0 && (
          <GlassCard className="p-5 text-sm text-muted-foreground">No clicks yet in this period. Grab your link from <b className="text-foreground">My links</b> and post it.</GlassCard>
        )}
      </div>
    );
  }

  if (tab === "links") {
    return (
      <div className="grid gap-4">
        <GlassCard className="grid gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <button key={c} onClick={() => setCh(c)} aria-pressed={ch === c}
                className={cn("ls-chip-glass px-3.5 py-1.5 text-sm font-semibold capitalize", ch === c && "bg-primary text-primary-foreground")}>{c === "x" ? "X" : c}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm">
            <span className="min-w-0 flex-1 truncate select-all">{link}</span>
            <Button size="sm" className="rounded-full" onClick={() => copy(link)}><Copy className="mr-1 h-4 w-4" />Copy</Button>
          </div>
          <p className="text-xs text-muted-foreground">Anyone who signs up within 30 days of tapping your link counts as yours (last link wins). In videos and podcasts, say <b className="text-foreground">linguascript.co.uk/r/{dash.partner.code}</b>.</p>
        </GlassCard>
      </div>
    );
  }

  if (tab === "audience") {
    return (
      <div className="grid gap-4">
        <div className="flex justify-end"><DaysPicker days={days} setDays={setDays} /></div>
        <GlassCard className="p-5">
          <h3 className="mb-3 font-bold">Channels</h3>
          <Table head={["Channel", "Clicks", "Sign-ups", "Rate"]}
            rows={dash.channels.map((c) => [c.channel, c.clicks, c.signups, pct(c.signups, c.clicks)])} />
        </GlassCard>
        <div className="grid gap-4 md:grid-cols-2">
          <GlassCard className="p-5"><h3 className="mb-3 font-bold">Devices</h3><Table head={["Device", "Clicks"]} rows={dash.devices.map((d) => [d.device, d.clicks])} /></GlassCard>
          <GlassCard className="p-5"><h3 className="mb-3 font-bold">Regions</h3><Table head={["Region", "Clicks"]} rows={dash.regions.map((r) => [r.region, r.clicks])} /></GlassCard>
        </div>
      </div>
    );
  }

  if (tab === "pages") {
    const arms = [["current", "The Chameleon Method page (control)"], ["gold", "Black & gold"], ["glass", "Liquid glass film frame"], ["split", "Split black & white"]];
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {arms.map(([k, l]) => (
          <a key={k} href={`/?lp=${k}`} target="_blank" rel="noreferrer">
            <GlassCard className="ls-press flex items-center justify-between gap-3 p-5"><div><Eyebrow>Homepage version</Eyebrow><p className="mt-1 font-bold">{l}</p></div><ExternalLink className="h-4 w-4 text-muted-foreground" /></GlassCard>
          </a>
        ))}
        <a href="/brand/site-studio.html" target="_blank" rel="noreferrer" className="md:col-span-2">
          <GlassCard accent="green" className="ls-press flex items-center justify-between gap-3 p-5"><div><Eyebrow>Design lab</Eyebrow><p className="mt-1 font-bold">Site Studio: every design we're testing</p></div><ExternalLink className="h-4 w-4 text-muted-foreground" /></GlassCard>
        </a>
      </div>
    );
  }

  if (tab === "new") {
    const items = [
      ["Save any word on any website", "Highlight a word, right-click, and it goes to your flashcards (Chrome extension)."],
      ["Gold words on the lock screen", "Android: words you know come back as a quick win on the lock screen and widget."],
      ["Tap subtitles in the YouTube app", "Android bubble: tap any subtitle word for its meaning."],
      ["Scan a page", "Circle words in a real book, take a photo, and they land in your decks."],
      ["Most common words decks", "Top 50 to Top 3,000, in frequency order."],
    ];
    return <div className="grid gap-3">{items.map(([t, d]) => <GlassCard key={t} className="p-5"><p className="font-bold">{t}</p><p className="text-sm text-muted-foreground">{d}</p></GlassCard>)}</div>;
  }

  if (tab === "brand") {
    const cols = [["Known", "#34C759"], ["Learning", "#FF9F0A"], ["New", "#FF453A"], ["Gold", "#FFD60A"]];
    return (
      <div className="grid gap-4">
        <GlassCard className="flex flex-wrap items-center gap-5 p-5">
          <img src="/logo.svg" alt="LinguaScript chameleon" width={120} height={60} />
          <div className="grid gap-2"><p className="font-bold">The chameleon logo</p>
            <a className="text-sm underline" href="/logo.svg" target="_blank" rel="noreferrer">Open the SVG (sharp at any size)</a></div>
        </GlassCard>
        <GlassCard className="flex flex-wrap gap-3 p-5">
          {cols.map(([n, c]) => <button key={n} onClick={() => copy(c)} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm"><i className="h-4 w-4 rounded-full" style={{ background: c }} />{n} <span className="font-mono text-xs text-muted-foreground">{c}</span></button>)}
        </GlassCard>
        <GlassCard accent="orange" className="p-5 text-sm"><p className="font-bold">Every post about LinguaScript must say it's an ad.</p><p className="text-muted-foreground">Put <b className="text-foreground">#ad</b> at the start of the caption, or use the platform's "paid partnership" label. UK advertising rules require it.</p></GlassCard>
      </div>
    );
  }

  if (tab === "payouts") {
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-3 gap-3">
          <Money label="On hold (30 days)" v={e.pending} />
          <Money label="Ready to pay" v={e.approved} gold />
          <Money label="Paid to you" v={e.paid} />
        </div>
        {e.next_available && <p className="text-sm text-muted-foreground">Next sale comes off hold on {new Date(e.next_available).toLocaleDateString()}.</p>}
        <GlassCard className="p-5"><h3 className="mb-3 font-bold">By month</h3>
          <Table head={["Month", "Sales", "Earned"]} rows={dash.months.map((m) => [m.month, m.sales, money(m.earned)])} empty="No sales yet." /></GlassCard>
        <GlassCard className="p-5"><h3 className="mb-3 font-bold">Payments sent</h3>
          <Table head={["Date", "Amount", "Method"]} rows={dash.payouts.map((p) => [new Date(p.date).toLocaleDateString(), money(p.amount), p.method.replace("_", " ")])} empty="Nothing paid yet. Payouts go out monthly once £20 is ready." /></GlassCard>
        {!dash.partner.has_payout_details && !isTeam && <p className="text-sm text-amber-300">Add where we should send your money in <b>Profile</b>.</p>}
      </div>
    );
  }

  if (tab === "profile") return <ProfileForm dash={dash} reload={reload} readOnly={isTeam && !isAdmin} isAdmin={isAdmin} />;

  // rules
  return (
    <GlassCard className="grid gap-2 p-5 text-sm">
      {[
        `You earn ${Math.round(dash.partner.commission_rate * 100)}% of what each person you refer pays (before tax), for their first ${dash.partner.commission_months} months.`,
        "A sale counts if they sign up within 30 days of tapping your link. The last partner link they tapped wins.",
        "Earnings wait 30 days before they can be paid, so refunds can be taken off. Refunds after payout come off your next payment.",
        "We pay monthly once at least £20 is ready. You handle your own tax.",
        "Label every post as an ad (#ad). No fake accounts, no signing yourself up, no ads on searches for “LinguaScript”.",
        "Partners must be 18 or over.",
        "Things we show you that aren't public yet stay private.",
      ].map((r) => <p key={r}>• {r}</p>)}
    </GlassCard>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <GlassCard className="p-4">
      <Eyebrow className="text-[9px]">{label}</Eyebrow>
      <p className="mt-1 text-2xl font-black"><CountUp value={value} /></p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </GlassCard>
  );
}
function Money({ label, v, gold }: { label: string; v: number; gold?: boolean }) {
  return <GlassCard accent={gold ? "gold" : undefined} className="p-4"><Eyebrow className="text-[9px]">{label}</Eyebrow><p className={cn("mt-1 text-xl font-black", gold && "text-amber-300")}>{money(v)}</p></GlassCard>;
}
export function Table({ head, rows, empty = "No data in this period." }: { head: string[]; rows: (string | number)[][]; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr>{head.map((h) => <th key={h} className="pb-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-white/5">{r.map((c, j) => <td key={j} className={cn("py-2 capitalize", j > 0 && "tabular-nums")}>{typeof c === "number" ? c.toLocaleString() : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function ProfileForm({ dash, reload, readOnly, isAdmin }: { dash: Dash; reload: () => void; readOnly: boolean; isAdmin: boolean }) {
  const p = dash.partner;
  const [name, setName] = useState(p.display_name);
  const [socials, setSocials] = useState<Record<string, string>>(p.socials || {});
  const [logo, setLogo] = useState(p.brand_logo_url || "");
  const [payout, setPayout] = useState("");
  const [busy, setBusy] = useState(false);
  const own = !readOnly && !isAdmin;
  const save = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("update_my_partner_profile", {
      _display_name: name, _socials: socials, _brand_logo_url: logo || null, _payout_details: payout || null,
    });
    setBusy(false);
    if (error) { toast.error("Couldn't save. Try again."); return; }
    toast.success("Saved"); setPayout(""); reload();
  };
  const approve = async (ok: boolean) => {
    const { error } = await (supabase as any).rpc("admin_approve_logo", { _partner_id: p.id, _ok: ok });
    if (error) toast.error(error.message); else { toast.success(ok ? "Logo approved" : "Logo removed"); reload(); }
  };
  const fields = useMemo(() => ["tiktok", "instagram", "youtube", "x"], []);
  return (
    <GlassCard className="grid gap-4 p-5">
      <label className="grid gap-1 text-sm"><span className="font-semibold">Name people know you by</span>
        <Input value={name} disabled={!own} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f} className="grid gap-1 text-sm"><span className="font-semibold capitalize">{f === "x" ? "X" : f}</span>
            <Input value={socials[f] || ""} disabled={!own} placeholder="@handle" onChange={(e) => setSocials({ ...socials, [f]: e.target.value.slice(0, 60) })} /></label>
        ))}
      </div>
      <label className="grid gap-1 text-sm"><span className="font-semibold">Logo link (https://…) <span className="font-normal text-muted-foreground">· shows after the team approves it</span></span>
        <Input value={logo} disabled={!own} onChange={(e) => setLogo(e.target.value)} /></label>
      {p.brand_logo_url && (
        <div className="flex items-center gap-3 text-sm">
          <img src={p.brand_logo_url} alt="Partner logo" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
          <span className={p.logo_approved ? "text-emerald-400" : "text-amber-300"}>{p.logo_approved ? "Approved" : "Waiting for approval"}</span>
          {isAdmin && !p.logo_approved && <><Button size="sm" onClick={() => approve(true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => approve(false)}>Remove</Button></>}
        </div>
      )}
      {own && (
        <label className="grid gap-1 text-sm"><span className="font-semibold">Where we send your money</span>
          <Input value={payout} type="text" autoComplete="off" placeholder={p.has_payout_details ? "Saved. Type here to replace it." : "Bank sort code + account, or PayPal email"} onChange={(e) => setPayout(e.target.value)} />
          <span className="text-xs text-muted-foreground">Only LinguaScript admins can see this.</span></label>
      )}
      {own && <Button className="w-fit rounded-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>}
    </GlassCard>
  );
}
