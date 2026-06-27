import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PETS } from "@/lib/pets";

export type ReactionType = "celebrate" | "dance" | "wave" | "happy" | "excited" | "idle";

interface PetContextValue {
  activePet: string | null;
  setActivePet: (petId: string) => Promise<void>;
  petCollection: string[];
  addToCollection: (petId: string) => Promise<void>;
  reaction: ReactionType;
  triggerReaction: (type: ReactionType, durationMs?: number) => void;
  isCompanionVisible: boolean;
}

const PetContext = createContext<PetContextValue | null>(null);

const FREE_PET_IDS = PETS.filter((p) => p.unlock.type === "free").map((p) => p.id);

export function PetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activePet, setActivePetState] = useState<string | null>(null);
  const [petCollection, setPetCollection] = useState<string[]>([]);
  const [reaction, setReaction] = useState<ReactionType>("idle");
  const [isCompanionVisible, setIsCompanionVisible] = useState(false);
  const [reactionTimer, setReactionTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Load pet data when user changes
  useEffect(() => {
    if (!user) {
      // Guest: try localStorage
      const stored = localStorage.getItem("ls.pet.v1");
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setActivePetState(data.activePet ?? FREE_PET_IDS[0]);
          setPetCollection(data.collection ?? FREE_PET_IDS);
        } catch {
          setActivePetState(FREE_PET_IDS[0]);
          setPetCollection(FREE_PET_IDS);
        }
      } else {
        setActivePetState(FREE_PET_IDS[0]);
        setPetCollection(FREE_PET_IDS);
      }
      return;
    }

    const loadPets = async () => {
      // Load active pet from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_pet")
        .eq("user_id", user.id)
        .single();

      const currentActivePet = (profile as any)?.active_pet ?? null;

      // Load collection
      const { data: collection } = await supabase
        .from("pet_collection")
        .select("pet_id")
        .eq("user_id", user.id);

      let ownedIds = (collection ?? []).map((r: any) => r.pet_id);

      // Seed free pets if collection is empty
      if (ownedIds.length === 0) {
        for (const petId of FREE_PET_IDS) {
          await supabase
            .from("pet_collection")
            .insert({ user_id: user.id, pet_id: petId })
            .throwOnError()
            .then(() => {})
            .catch(() => {});
        }
        ownedIds = FREE_PET_IDS;
      }

      setPetCollection(ownedIds);
      setActivePetState(currentActivePet ?? ownedIds[0] ?? null);
      if (currentActivePet || ownedIds.length > 0) {
        setIsCompanionVisible(true);
      }
    };

    loadPets();
  }, [user]);

  const setActivePet = useCallback(async (petId: string) => {
    setActivePetState(petId);
    setIsCompanionVisible(true);

    if (!user) {
      const stored = localStorage.getItem("ls.pet.v1");
      const data = stored ? JSON.parse(stored) : { collection: FREE_PET_IDS };
      localStorage.setItem("ls.pet.v1", JSON.stringify({ ...data, activePet: petId }));
      return;
    }

    await supabase
      .from("profiles")
      .update({ active_pet: petId } as any)
      .eq("user_id", user.id);
  }, [user]);

  const addToCollection = useCallback(async (petId: string) => {
    if (petCollection.includes(petId)) return;
    setPetCollection((prev) => [...prev, petId]);

    if (user) {
      await supabase
        .from("pet_collection")
        .insert({ user_id: user.id, pet_id: petId })
        .then(() => {})
        .catch(() => {});
    }
  }, [petCollection, user]);

  const triggerReaction = useCallback((type: ReactionType, durationMs = 3000) => {
    if (reactionTimer) clearTimeout(reactionTimer);
    setReaction(type);
    setIsCompanionVisible(true);

    const timer = setTimeout(() => setReaction("idle"), durationMs);
    setReactionTimer(timer);
  }, [reactionTimer]);

  return (
    <PetContext.Provider value={{
      activePet,
      setActivePet,
      petCollection,
      addToCollection,
      reaction,
      triggerReaction,
      isCompanionVisible,
    }}>
      {children}
    </PetContext.Provider>
  );
}

export function usePet() {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error("usePet must be used within PetProvider");
  return ctx;
}
