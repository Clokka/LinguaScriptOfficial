import { useEffect, useState } from "react";
import { Gift, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { claimDailyChest, CHEST_GEMS, emitRewardsChanged } from "@/lib/rewards";
import { GiftBoxReveal, type GiftContents } from "./GiftBoxReveal";

/** Shown on the home page once today's word goal is met. */
export function DailyChestCard({ goalMet }: { goalMet: boolean }) {
  const { user } = useAuth();
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [contents, setContents] = useState<GiftContents | null>(null);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    (supabase as any)
      .from("reward_claims")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", "daily")
      .eq("key", today)
      .maybeSingle()
      .then(({ data }: any) => setClaimed(!!data));
  }, [user]);

  if (!user || !goalMet || claimed === null) return null;

  return (
    <>
      <button
        onClick={() => {
          if (claimed) return;
          setContents({ title: "Daily chest", gems: 0 });
          setOpen(true);
        }}
        disabled={claimed}
        className="w-full mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-4 text-left"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          {claimed ? <Check className="w-6 h-6 text-primary" /> : <Gift className="w-6 h-6 text-primary animate-bounce" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">Daily chest</p>
          <p className="font-bold text-foreground">
            {claimed ? "Opened — come back tomorrow" : "Goal reached! Tap to open"}
          </p>
          <p className="text-xs text-muted-foreground">
            Bigger every day in a row: {CHEST_GEMS.join(" → ")} gems
          </p>
        </div>
      </button>
      <GiftBoxReveal
        open={open}
        onClose={() => setOpen(false)}
        contents={contents}
        onOpen={async () => {
          const r = await claimDailyChest();
          setContents({ title: `Daily chest · ${r.run} day${r.run === 1 ? "" : "s"} in a row`, gems: r.gems });
          setClaimed(true);
          emitRewardsChanged();
        }}
      />
    </>
  );
}
