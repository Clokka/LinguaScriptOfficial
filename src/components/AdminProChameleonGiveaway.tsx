import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Copy, Check, Loader2, Sparkles, Crown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PUBLIC_ORIGIN = "https://linguascript.co.uk";

interface LinkRow {
  id: string;
  token: string;
  label: string | null;
  active: boolean;
  created_at: string;
}

interface ClaimRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  link_label: string | null;
  is_pro: boolean;
  claimed_at: string;
}

type RpcFn = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

type AnyFrom = {
  from: (t: string) => {
    select: (s: string) => {
      order: (c: string, o: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: LinkRow[] | null }>;
      };
    };
  };
};

/**
 * Reusable Pro + chameleon giveaway links (unlimited claims per link),
 * plus the roster of every account that redeemed one.
 */
export function AdminProChameleonGiveaway() {
  const [label, setLabel] = useState("");
  const [minting, setMinting] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const [{ data: linkData }, { data: claimData }] = await Promise.all([
      (supabase as unknown as AnyFrom)
        .from("pro_chameleon_links")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25),
      (supabase.rpc as unknown as RpcFn)("admin_list_pro_chameleon_claims"),
    ]);
    setLinks(linkData ?? []);
    setClaims((claimData as ClaimRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const mint = async () => {
    setMinting(true);
    const { data, error } = await (supabase.rpc as unknown as RpcFn)("create_pro_chameleon_link", {
      _label: label.trim() || null,
    });
    setMinting(false);
    const payload = data as { token?: string; error?: string } | null;
    if (error || payload?.error) {
      toast({
        title: "Couldn't create giveaway link",
        description: payload?.error ?? error?.message ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Giveaway link created" });
    setLabel("");
    void load();
  };

  const toggle = async (row: LinkRow) => {
    await (supabase as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, v: string) => Promise<{ error: unknown }>;
        };
      };
    })
      .from("pro_chameleon_links")
      .update({ active: !row.active })
      .eq("id", row.id);
    void load();
  };

  const copy = (token: string) => {
    navigator.clipboard.writeText(`${PUBLIC_ORIGIN}/pro-chameleon?token=${token}`);
    setCopied(token);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="glass-panel-strong p-6 mb-8 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-success/15 border border-success/30 flex items-center justify-center">
          <Gift className="w-4 h-4 text-success" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Pro + chameleon giveaway links
          </h2>
          <p className="text-xs text-muted-foreground">
            Shareable links anyone can claim — each new account gets the chameleon and lifetime
            Pro.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Campaign label (e.g. TikTok launch)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="bg-secondary/50 border-border"
        />
        <Button variant="hero" onClick={mint} disabled={minting} className="gap-2">
          {minting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Create link
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No giveaway links yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {links.map((l) => (
                <div key={l.id} className="glass-panel p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">
                      {l.label ?? "Pro + chameleon giveaway"}
                      <span className="text-muted-foreground"> · unlimited claims</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {PUBLIC_ORIGIN}/pro-chameleon?token={l.token}
                    </p>
                  </div>
                  <Button variant="glass" size="sm" className="gap-1" onClick={() => copy(l.token)}>
                    {copied === l.token ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggle(l)}>
                    {l.active ? "Pause" : "Resume"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-border/50 space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">
                Claimed accounts ({claims.length})
              </h3>
            </div>
            {claims.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nobody has claimed yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {claims.map((c) => (
                  <div
                    key={`${c.user_id}-${c.claimed_at}`}
                    className="flex items-center gap-3 text-sm glass-panel px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate">
                        {c.display_name ?? c.username ?? "Learner"}
                        <span className="text-muted-foreground"> · {c.email ?? "no email"}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.link_label ?? "Giveaway"} ·{" "}
                        {new Date(c.claimed_at).toLocaleDateString()}
                      </p>
                    </div>
                    {c.is_pro && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-400 bg-amber-500/10 rounded px-2 py-1">
                        Pro
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
