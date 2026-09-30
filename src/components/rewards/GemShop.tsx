import { useState } from "react";
import { Gem, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePet } from "@/contexts/PetContext";
import { buyShopItem, emitRewardsChanged, type loadRewardState } from "@/lib/rewards";

type State = Awaited<ReturnType<typeof loadRewardState>>;

export function GemShop({ open, onClose, state }: { open: boolean; onClose: () => void; state: State }) {
  const { toast } = useToast();
  const { petCollection } = usePet();
  const [busy, setBusy] = useState<string | null>(null);

  const owned = (id: string, kind: string) =>
    kind === "pet" ? petCollection.includes(id) : kind === "accessory" ? state.items.includes(id) : false;

  const buy = async (id: string, name: string) => {
    setBusy(id);
    try {
      await buyShopItem(id);
      toast({ title: `${name} unlocked!` });
      emitRewardsChanged();
      if (state.shop.find((i) => i.id === id)?.kind === "pet") setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast({ title: "Couldn't buy that", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center justify-between">
          Gem shop
          <span className="inline-flex items-center gap-1 text-sm tabular-nums">
            <Gem className="w-4 h-4 text-accent" /> {state.gems}
          </span>
        </DialogTitle>
        <DialogDescription>Looks only. Gems never buy XP or skip learning.</DialogDescription>
        <div className="space-y-2">
          {state.shop.map((i) => {
            const have = owned(i.id, i.kind) || (i.kind === "freeze" && state.freezes >= 2);
            return (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 p-3">
                <span className="text-2xl">{i.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{i.name}</p>
                  {i.kind === "freeze" && (
                    <p className="text-xs text-muted-foreground">Saves your streak if you miss a day · {state.freezes}/2</p>
                  )}
                </div>
                {have ? (
                  <span className="text-xs text-primary inline-flex items-center gap-1"><Check className="w-3 h-3" /> {i.kind === "freeze" ? "Full" : "Owned"}</span>
                ) : (
                  <Button size="sm" disabled={busy === i.id || state.gems < i.price} onClick={() => buy(i.id, i.name)} className="gap-1 tabular-nums">
                    <Gem className="w-3 h-3" /> {i.price}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
