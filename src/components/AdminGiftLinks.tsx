import { useEffect, useState } from "react";
import { Gift, Copy, Check, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { PETS } from "@/lib/pets";
import { ACCESSORIES } from "@/lib/accessories";

// Public site origin: gift links are meant to be opened by anyone, so we
// always emit them against the production domain regardless of whether the
// admin is being viewed inside the Lovable dashboard preview iframe.
const PUBLIC_ORIGIN = "https://linguascript.co.uk";

interface LinkRow {
  id: string;
  token: string;
  pet_id: string;
  accessories: string[] | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  expires_at: string;
}

export function AdminGiftLinks() {
  const { toast } = useToast();
  const [petId, setPetId] = useState<string>(PETS[0]?.id ?? "hedgehog");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [minting, setMinting] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleAccessory = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchLinks = async () => {
    // pet_gift_links is not in the generated typed schema — access via untyped client.
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: LinkRow[] | null }>;
          };
        };
      };
    })
      .from("pet_gift_links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setLinks(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const mint = async () => {
    setMinting(true);
    const chosen = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("create_gift_link", {
      p_pet_id: petId,
      p_accessories: chosen.length > 0 ? chosen : null,
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
    toast({ title: "Gift link created" });
    fetchLinks();
    setSelected({});
  };

  const copyLink = (token: string) => {
    const url = `${PUBLIC_ORIGIN}/gift?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="mt-12">
      <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
        <Gift className="w-5 h-5 text-primary" /> Gift Links
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Mint a single-use gift link. Optionally attach accessories that the
        recipient's pet arrives already wearing.
      </p>

      <div className="glass-panel-strong p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pet</label>
            <Select value={petId} onValueChange={setPetId}>
              <SelectTrigger className="bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              You must already own this pet in your collection.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Extras (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {[...ACCESSORIES, { id: "flowers", name: "Flowers", emoji: "💐" }].map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/40 border border-border cursor-pointer text-sm text-foreground"
                >
                  <Checkbox
                    checked={!!selected[a.id]}
                    onCheckedChange={() => toggleAccessory(a.id)}
                  />
                  <span>
                    {a.emoji} {a.name}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Flowers only appear in the unboxing scene if you tick them here.
            </p>
          </div>
        </div>

        <Button
          variant="hero"
          onClick={mint}
          disabled={minting}
          className="gap-2"
        >
          {minting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Create gift link
        </Button>
      </div>

      <div className="mt-6">
        <h3 className="text-sm text-muted-foreground mb-3">Recent links</h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            You haven't minted any gift links yet.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((row) => {
              const pet = PETS.find((p) => p.id === row.pet_id);
              const url = `${PUBLIC_ORIGIN}/gift?token=${row.token}`;
              const claimed = !!row.claimed_by;
              return (
                <div
                  key={row.id}
                  className="glass-panel p-3 flex items-center gap-3"
                >
                  <div className="text-xl">{pet?.emoji ?? "🎁"}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">
                      {pet?.name ?? row.pet_id}
                      {row.accessories && row.accessories.length > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          + {row.accessories.join(", ")}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {url}
                    </p>
                  </div>
                  {claimed ? (
                    <span className="text-[10px] uppercase tracking-wide text-success bg-success/10 rounded px-2 py-1">
                      Claimed
                    </span>
                  ) : (
                    <Button
                      variant="glass"
                      size="sm"
                      className="gap-1"
                      onClick={() => copyLink(row.token)}
                    >
                      {copiedId === row.token ? (
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
