import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Search, Loader2, X, Crown, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SearchRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  is_pro: boolean;
  pro_source: string;
  pro_expires_at: string | null;
}

interface ProUser {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  pro_source: string;
  pro_expires_at: string | null;
  pro_granted_at: string | null;
}

export function AdminProGrants() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [days, setDays] = useState<string>("");
  const [proUsers, setProUsers] = useState<ProUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

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
      if (data) void loadProUsers();
    })();
  }, []);

  const loadProUsers = async () => {
    const { data, error } = await (supabase as any).rpc("admin_list_pro_users");
    if (error) { console.error(error); return; }
    setProUsers((data as ProUser[]) ?? []);
  };

  const runSearch = async () => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    const { data, error } = await (supabase as any).rpc("admin_search_users", { _q: query.trim() });
    setSearching(false);
    if (error) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
      return;
    }
    setResults((data as SearchRow[]) ?? []);
  };

  const grant = async (userId: string) => {
    setBusy(userId);
    const parsed = days ? parseInt(days, 10) : null;
    const { error } = await (supabase as any).rpc("admin_grant_pro", {
      _user_id: userId,
      _days: parsed && parsed > 0 ? parsed : null,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Grant failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pro granted", description: parsed ? `For ${parsed} days` : "Lifetime access" });
    await Promise.all([runSearch(), loadProUsers()]);
  };

  const revoke = async (userId: string) => {
    setBusy(userId);
    const { error } = await (supabase as any).rpc("admin_revoke_pro", { _user_id: userId });
    setBusy(null);
    if (error) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pro revoked" });
    await Promise.all([runSearch(), loadProUsers()]);
  };

  if (isAdmin === null) return null;
  if (isAdmin === false) {
    return (
      <div className="glass-panel p-4 mb-8 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="w-4 h-4" /> You're not signed in as an admin — Pro grants are hidden.
      </div>
    );
  }

  return (
    <div className="glass-panel-strong p-6 mb-8 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Crown className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pro grants</h2>
          <p className="text-xs text-muted-foreground">Give selected accounts free Pro access. Paid subscriptions are unaffected.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search by email, username, or display name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void runSearch(); } }}
          className="bg-secondary/50 border-border"
        />
        <Input
          placeholder="Days (blank = lifetime)"
          value={days}
          onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))}
          className="bg-secondary/50 border-border sm:w-44"
        />
        <Button variant="hero" onClick={runSearch} disabled={searching} className="gap-2">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Results</p>
          {results.map((r) => (
            <div key={r.user_id} className="glass-panel p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {r.display_name || r.username || r.email || r.user_id}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.email} {r.is_pro && <span className="text-amber-400">· Pro ({r.pro_source})</span>}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {r.is_pro && r.pro_source === "admin_grant" && (
                  <Button variant="ghost" size="sm" onClick={() => revoke(r.user_id)} disabled={busy === r.user_id}>
                    <X className="w-4 h-4 mr-1" /> Revoke
                  </Button>
                )}
                <Button variant="hero" size="sm" onClick={() => grant(r.user_id)} disabled={busy === r.user_id} className="gap-1">
                  {busy === r.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {r.is_pro ? "Refresh" : "Grant Pro"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Pro users ({proUsers.length})</p>
          <Button variant="ghost" size="sm" onClick={loadProUsers}>Refresh</Button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {proUsers.length === 0 && <p className="text-xs text-muted-foreground">No Pro users yet.</p>}
          {proUsers.map((u) => (
            <div key={u.user_id} className="glass-panel p-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-foreground truncate">{u.display_name || u.username || u.email}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {u.email} · <span className="text-amber-400">{u.pro_source}</span>
                  {u.pro_expires_at && ` · expires ${new Date(u.pro_expires_at).toLocaleDateString()}`}
                </p>
              </div>
              {u.pro_source === "admin_grant" && (
                <Button variant="ghost" size="sm" onClick={() => revoke(u.user_id)} disabled={busy === u.user_id}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
