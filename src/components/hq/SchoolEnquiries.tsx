import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/premium";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
type Enquiry = Database["public"]["Tables"]["school_enquiries"]["Row"];
export default function SchoolEnquiries() {
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    const result = await supabase.from("school_enquiries").select("*").order("created_at", { ascending: false }).limit(100);
    if (result.error) setError("School requests couldn't load. Please try again.");
    else setRows(result.data || []);
    setBusy(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section className="space-y-5"><div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">School enquiries</h2><Button variant="outline" size="icon" onClick={() => void load()} disabled={busy} aria-label="Refresh school enquiries"><RefreshCw className="h-4 w-4" /></Button></div><p className="text-sm text-muted-foreground">Newest 100 requests. Reply personally, agree scope and price, then record the outcome. No automated quote, payment or email is sent.</p>{error && <p role="alert" className="text-destructive">{error}</p>}{busy ? <Skeleton className="h-48" /> : rows.length === 0 ? <p className="py-8 text-muted-foreground">No school requests received yet.</p> : rows.map(row => <article key={row.id} className="space-y-3 border-t border-border py-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-lg font-bold">{row.school_name}</h3><p className="text-sm text-muted-foreground">{row.contact_name} · {row.student_count ?? "Unspecified"} students · {new Date(row.created_at).toLocaleDateString()}</p></div><Select value={row.status} onValueChange={async status => { const result = await supabase.from("school_enquiries").update({ status }).eq("id", row.id); if (result.error) setError("The status wasn't saved. Please try again."); else setRows(xs => xs.map(x => x.id === row.id ? { ...x, status } : x)); }}><SelectTrigger className="w-36" aria-label={`Status for ${row.school_name}`}><SelectValue /></SelectTrigger><SelectContent>{["new", "contacted", "quoted", "closed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><p className="whitespace-pre-wrap break-words text-sm">{row.needs}</p><Button asChild variant="outline" size="sm"><a href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`LinguaScript — ${row.school_name}`)}`}><Mail className="mr-2 h-4 w-4" />Reply to {row.contact_name}</a></Button><p className="break-all text-xs text-muted-foreground">{row.email} · Reference {row.id.slice(0, 8)}</p></article>)}</section>;
}