import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePet } from "@/contexts/PetContext";
import { getPetById, RARITY_COLORS, unlockLabel, PET_MILESTONES_EVENT } from "@/lib/pets";

/**
 * Grants milestone pets (7-day streak, 10 / 25 videos watched) and shows a
 * "New pet!" moment for each one. The server decides what's earned
 * (claim_pet_milestones); this runs when the app opens and whenever
 * checkPetMilestones() fires — after the daily chest and after a video —
 * so it never stacks on top of another celebration. Mount once at the root.
 */
export function PetMilestoneUnlock() {
  const { user } = useAuth();
  const { addToCollection, setActivePet, triggerReaction } = usePet();
  const [queue, setQueue] = useState<string[]>([]);

  const check = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("claim_pet_milestones");
    if (error || !data?.length) return;
    const ids = data.filter((id) => getPetById(id));
    for (const id of ids) await addToCollection(id);
    setQueue((q) => [...q, ...ids.filter((id) => !q.includes(id))]);
    triggerReaction("celebrate", 4000);
  }, [user, addToCollection, triggerReaction]);

  useEffect(() => {
    void check();
    const handler = () => void check();
    window.addEventListener(PET_MILESTONES_EVENT, handler);
    return () => window.removeEventListener(PET_MILESTONES_EVENT, handler);
  }, [check]);

  const pet = queue.length ? getPetById(queue[0]) : null;
  const next = () => setQueue((q) => q.slice(1));

  return (
    <Dialog open={!!pet} onOpenChange={(open) => !open && next()}>
      <DialogContent className="max-w-xs rounded-3xl border-border bg-background p-8 text-center">
        {pet && (
          <>
            <DialogTitle className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">New pet!</DialogTitle>
            <div className="mx-auto my-2 text-8xl animate-bounce-in" aria-hidden>{pet.emoji}</div>
            <p className="text-2xl font-bold text-foreground">{pet.name}</p>
            <p className={`text-xs font-semibold uppercase tracking-wider ${RARITY_COLORS[pet.rarity]}`}>{pet.rarity}</p>
            <p className="mt-1 text-sm text-muted-foreground">{unlockLabel(pet.unlock)} ✓</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                className="rounded-full"
                onClick={() => {
                  void setActivePet(pet.id);
                  next();
                }}
              >
                Make {pet.name} my companion
              </Button>
              <Button variant="ghost" className="rounded-full" onClick={next}>
                Later
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
