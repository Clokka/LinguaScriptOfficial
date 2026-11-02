// Growth-team tools inside /partners (lazy chunk: only team members load it).
//   mode "team"   → every partner at a glance; admins also add partners,
//                   give team logins, approve and pay.
//   mode "studio" → Site Studio (public/brand/site-studio.html) in a lazy
//                   iframe, so its ~700 kB of labs never reach visitors.
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, Eyebrow, Skeleton } from "@/components/premium";
import { money } from "@/pages/Partners";

const StudioFrame = lazy(() => import("@/components/hq/StudioFrame"));

type Row = { id: string; code: string; display_name: string; status: string; commission_rate: number;
  clicks: number; signups: number; sales: number; pending: number; approved: number; paid: number };

type Props = { mode: "team" | "studio"; isAdmin: boolean; days: number; setDays: (d: number) => void; onOpen: (id: string) => void };

const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

export default function TeamTools({ mode, isAdmin, days, setDays, onOpen }: Props) {
  if (mode === "studio") return <Studio />;
  return <Team isAdmin={isAdmin} days={days} setDays={setDays} onOpen={onOpen} />;
}

// The connected Studio (same as HQ → Studio), so "Go live" works here too.
function Studio() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StudioFrame />
    </Suspense>
  );
}

function Team({ isAdmin, days, setDays, onOpen }: Omit<Props, "mode">) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(async () => {
    setRows(null);
    const { data, error } = await rpc("growth_partners_overview", { _days: days });
    if (error) { toast.error(error.message); setRows([]); return; }
    setRows((data as Row[]) ?? []);
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const csv = () => {
    if (!rows) return;
    const head = ["code", "name", "status", "rate", "clicks", "signups", "sales", "pending_gbp", "approved_gbp", "paid_gbp"];
    const lines = rows.map((r) => [r.code, r.display_name, r.status, r.commission_rate, r.clicks, r.signups, r.sales,
      (r.pending / 100).toFixed(2), (r.approved / 100).toFixed(2), (r.paid / 100).toFixed(2)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `partners-${days}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90, 365].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${days === d ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            {d === 365 ? "1 year" : `${d} days`}
          </button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={csv} disabled={!rows?.length}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={async () => {
            const { data, error } = await rpc("approve_due_commissions");
            if (error) toast.error(error.message); else { toast.success(`${data ?? 0} commission(s) approved`); void load(); }
          }}>Approve due</Button>
        )}
      </div>

      <GlassCard className="p-4">
        {rows === null ? <Skeleton className="h-40" /> : !rows.length ? (
          <p className="text-sm text-muted-foreground">No partners yet.{isAdmin && " Add the first one below."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{["Partner", "Status", "Rate", "Clicks", "Sign-ups", "Sales", "On hold", "To pay", "Paid", ""].map((h) => (
                <th key={h} className="pb-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{h}</th>))}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2"><b>{r.display_name || r.code}</b> <span className="text-muted-foreground font-mono text-xs">/{r.code}</span></td>
                    <td className="capitalize">{r.status}</td>
                    <td className="tabular-nums">{Math.round(r.commission_rate * 100)}%</td>
                    <td className="tabular-nums">{r.clicks}</td>
                    <td className="tabular-nums">{r.signups}</td>
                    <td className="tabular-nums">{r.sales}</td>
                    <td className="tabular-nums">{money(r.pending)}</td>
                    <td className="tabular-nums font-semibold">{money(r.approved)}</td>
                    <td className="tabular-nums">{money(r.paid)}</td>
                    <td className="whitespace-nowrap space-x-1 text-right">
                      <Button size="sm" variant="ghost" onClick={() => onOpen(r.id)}>Open</Button>
                      {isAdmin && <PayButton row={r} onDone={load} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {isAdmin && <AdminForms onDone={load} />}
    </div>
  );
}

function PayButton({ row, onDone }: { row: Row; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  if (!open) return <Button size="sm" variant="outline" disabled={row.approved <= 0} onClick={() => setOpen(true)}>Pay</Button>;
  return (
    <div className="mt-2 flex flex-col items-end gap-1 text-left">
      <button className="text-xs underline" onClick={async () => {
        const { data, error } = await rpc("admin_partner_payout_details", { _partner_id: row.id });
        if (error) toast.error(error.message); else setDetails((data as string) || "No payout details yet.");
      }}>Show payout details</button>
      {details && <p className="max-w-[16rem] whitespace-pre-wrap rounded bg-white/5 p-2 text-xs select-all">{details}</p>}
      <div className="flex gap-1">
        <Input className="h-8 w-40" placeholder="Bank / PayPal ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        <Button size="sm" onClick={async () => {
          const { data, error } = await rpc("admin_mark_commissions_paid", { _partner_id: row.id, _reference: ref || null });
          if (error) { toast.error(error.message); return; }
          toast.success(`Marked ${money(Number(data) || 0)} as paid`); setOpen(false); onDone();
        }}>Mark {money(row.approved)} paid</Button>
      </div>
    </div>
  );
}

function AdminForms({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState({ email: "", code: "", name: "", rate: "25", months: "12", status: "active" });
  const [t, setT] = useState({ email: "", role: "marketer" });
  const [busy, setBusy] = useState(false);

  const addPartner = async () => {
    setBusy(true);
    const { error } = await rpc("admin_upsert_partner", {
      _email: p.email.trim(), _code: p.code.trim().toLowerCase(), _display_name: p.name.trim(),
      _rate: Math.min(60, Math.max(0, Number(p.rate) || 0)) / 100, _months: Number(p.months) || 12, _status: p.status,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Partner saved. Their link: linguascript.co.uk/r/${p.code.trim().toLowerCase()}`);
    setP({ ...p, email: "", code: "", name: "" }); onDone();
  };
  const setRole = async (grant: boolean) => {
    setBusy(true);
    const { error } = await rpc("admin_set_team_role", { _email: t.email.trim(), _role: t.role, _grant: grant });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(grant ? "Login given" : "Login removed"); setT({ ...t, email: "" }); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GlassCard className="p-4 space-y-2">
        <Eyebrow>Add or update a partner</Eyebrow>
        <p className="text-xs text-muted-foreground">They need a LinguaScript account first. Same email again = update.</p>
        <Input placeholder="Their account email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
        <div className="flex gap-2">
          <Input placeholder="link code, e.g. maya" value={p.code} onChange={(e) => setP({ ...p, code: e.target.value })} />
          <Input placeholder="Display name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </div>
        <div className="flex gap-2 items-center text-sm">
          <Input className="w-20" type="number" min={0} max={60} value={p.rate} onChange={(e) => setP({ ...p, rate: e.target.value })} />% for
          <Input className="w-20" type="number" min={1} max={120} value={p.months} onChange={(e) => setP({ ...p, months: e.target.value })} />months
          <select className="ml-auto rounded-md bg-transparent border border-white/10 px-2 py-2" value={p.status}
            onChange={(e) => setP({ ...p, status: e.target.value })}>
            <option value="active">Active</option><option value="pending">Pending</option><option value="paused">Paused</option>
          </select>
        </div>
        <Button className="w-full" disabled={busy || !p.email || !p.code} onClick={addPartner}>Save partner</Button>
      </GlassCard>

      <GlassCard className="p-4 space-y-2">
        <Eyebrow>Team logins</Eyebrow>
        <p className="text-xs text-muted-foreground">Marketing team = sees every partner and the Site Studio, never payouts or learner data.</p>
        <Input placeholder="Their account email" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} />
        <select className="w-full rounded-md bg-transparent border border-white/10 px-2 py-2 text-sm" value={t.role}
          onChange={(e) => setT({ ...t, role: e.target.value })}>
          <option value="marketer">Marketing team</option><option value="partner">Partner</option>
        </select>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy || !t.email} onClick={() => setRole(true)}>Give login</Button>
          <Button className="flex-1" variant="outline" disabled={busy || !t.email} onClick={() => setRole(false)}>Remove</Button>
        </div>
      </GlassCard>
    </div>
  );
}
