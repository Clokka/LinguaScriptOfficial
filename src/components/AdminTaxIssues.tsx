import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";

interface TaxIssueRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  tax_issue_detected_at: string | null;
}

/**
 * Surfaces subscriptions Stripe couldn't bill because tax calculation failed
 * (invoice.finalization_failed with automatic_tax.status ==
 * "requires_location_inputs") — the customer's saved address is missing or
 * insufficient. Left unnoticed, that subscription just silently stops being
 * charged. The row disappears here on its own once a later invoice pays
 * successfully; nothing to dismiss by hand.
 */
export function AdminTaxIssues() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<TaxIssueRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      if (data) void load();
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_list_tax_issues");
    setLoading(false);
    if (error) { console.error(error); return; }
    setRows((data as TaxIssueRow[]) ?? []);
  };

  if (isAdmin === null) return null;
  if (isAdmin === false) return null;

  return (
    <div className="glass-panel-strong p-6 mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tax billing issues</h2>
            <p className="text-xs text-muted-foreground">
              Subscriptions Stripe couldn't bill because tax calculation failed — the customer's
              saved address needs updating.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4" /> No tax billing issues right now.
        </div>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.stripe_subscription_id ?? r.user_id} className="glass-panel p-2.5 text-sm">
              <p className="text-foreground truncate">{r.display_name || r.email || r.user_id}</p>
              <p className="text-xs text-muted-foreground truncate">
                {r.email} · status: {r.status ?? "unknown"}
                {r.tax_issue_detected_at && ` · flagged ${new Date(r.tax_issue_detected_at).toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
