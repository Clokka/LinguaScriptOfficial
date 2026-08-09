import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Copy, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PUBLIC_ORIGIN = "https://linguascript.co.uk";

interface LinkRow {
  id: string;
  token: string;
  days: number | null;
  note: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  expires_at: string;
}

type RpcFn = (
  fn: string,
  args?: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

export function AdminProGiftLinks() {
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [minting, setMinting] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          order: (c: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: LinkRow[] | null }>;
          };
        };
      };
    })
      .from("pro_gift_links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    setLinks(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const mint = async () => {
    setMinting(true);
    const parsed = days ? parseInt(days, 10) : null;
    const { data, error } = await (supabase.rpc as unknown as RpcFn)("create_pro_gift_link", {
      _days: parsed && parsed > 0 ? parsed : null,
      _note: note.trim() || null,
    });
    setMinting(false);
    const payload = data as { token?: string; error?: string } | null;
    if (error || payload?.error) {
      toast({
        title: "Couldn't create link",
        description: payload?.error ?? error?.message ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Pro gift link created" });
    setNote("");
    void load();
  };

  const copy = (token: string) => {
    navigator.clipboard.writeText(`${PUBLIC_ORIGIN}/pro-gift?token=${token}`);
    setCopied(token);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="glass-panel-strong p-6 mb-8 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Crown className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pro gift links</h2>
          <p className="text-xs text-muted-foreground">
            Single-use links that unlock Pro for whoever redeems them.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Days (blank = lifetime)"
          value={days}
          onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))}
          className="bg-secondary/50 border-border sm:w-52"
        />
        <Input
          placeholder="Note (e.g. Year 12 French class)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No Pro gift links yet.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {links.map((l) => (
            <div key={l.id} className="glass-panel p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">
                  {l.days ? `${l.days} days of Pro` : "Lifetime Pro"}
                  {l.note && <span className="text-muted-foreground"> · {l.note}</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {PUBLIC_ORIGIN}/pro-gift?token={l.token}
                </p>
              </div>
              {l.claimed_by ? (
                <span className="text-[10px] uppercase tracking-wide text-success bg-success/10 rounded px-2 py-1">
                  Redeemed
                </span>
              ) : (
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
