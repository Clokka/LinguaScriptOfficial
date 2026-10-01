import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REWARDS_CHANGED } from "@/lib/rewards";

interface Item { id: string; name: string; emoji: string; rarity: string; description: string | null }

/** Cosmetics earned through real achievements (not buyable). */
export function AchievementCosmetics() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: it }, { data: own }] = await Promise.all([
        (supabase as any).from("shop_items").select("id,name,emoji,rarity,description").eq("unlock", "achievement").order("sort_order"),
        (supabase as any).from("user_items").select("item_id").eq("user_id", user.id),
      ]);
      setItems((it as Item[]) || []);
      setOwned(new Set(((own as any[]) || []).map((r) => r.item_id)));
    };
    void load();
    window.addEventListener(REWARDS_CHANGED, load);
    return () => window.removeEventListener(REWARDS_CHANGED, load);
  }, [user]);

  if (!items.length) return null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-foreground mb-2">Earned cosmetics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((i) => {
          const has = owned.has(i.id);
          return (
            <div key={i.id} className={`rounded-xl border p-3 text-center ${has ? "border-primary/40 bg-primary/5" : "border-border opacity-60"}`}>
              <div className="text-2xl">{has ? i.emoji : <Lock className="w-5 h-5 mx-auto text-muted-foreground" />}</div>
              <p className="text-xs font-semibold text-foreground mt-1">{i.name}</p>
              <p className="text-[10px] text-muted-foreground">{i.description}</p>
              <p className="text-[10px] uppercase tracking-wide text-primary mt-0.5">{i.rarity}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
