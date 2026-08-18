import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PETS } from "@/lib/pets";

// "perfect" is the chained 100% celebration — handled specially in PetCompanion
export type ReactionType = "celebrate" | "dance" | "wave" | "happy" | "excited" | "perfect" | "idle";

interface PetContextValue {
  activePet: string | null;
  setActivePet: (petId: string) => Promise<void>;
  petCollection: string[];
  addToCollection: (petId: string) => Promise<void>;
  reaction: ReactionType;
  triggerReaction: (type: ReactionType, durationMs?: number) => void;
  isCompanionVisible: boolean;
}

export const PetContext = createContext<PetContextValue | null>(null);

const FREE_PET_IDS = PETS.filter((p) => p.unlock.type === "free").map((p) => p.id);
const DEFAULT_PET = "chameleon";

// How long "perfect" lasts in total (3 chained animations × 3s each)
const PERFECT_DURATION = 9000;

export function PetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activePet, setActivePetState] = useState<string | null>(null);
  const [petCollection, setPetCollection] = useState<string[]>([]);
  const [reaction, setReaction] = useState<ReactionType>("idle");
  const [isCompanionVisible, setIsCompanionVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem("ls.pet.v1");
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setActivePetState(data.activePet ?? DEFAULT_PET);
          setPetCollection(data.collection ?? FREE_PET_IDS);
        } catch {
          setActivePetState(DEFAULT_PET);
          setPetCollection(FREE_PET_IDS);
        }
      } else {
        setActivePetState(DEFAULT_PET);
        setPetCollection(FREE_PET_IDS);
      }
      return;
    }

    const loadPets = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_pet")
        .eq("user_id", user.id)
        .single();

      const currentActivePet = (profile as any)?.active_pet ?? null;

      const { data: collection } = await (supabase as any)
        .from("pet_collection")
        .select("pet_id")
        .eq("user_id", user.id);

      let ownedIds = (collection ?? []).map((r: any) => r.pet_id);

      if (ownedIds.length === 0) {
        for (const petId of FREE_PET_IDS) {
          try {
            await (supabase as any)
              .from("pet_collection")
              .insert({ user_id: user.id, pet_id: petId });
          } catch {}
        }
        ownedIds = FREE_PET_IDS;
      }

      setPetCollection(ownedIds);
      setActivePetState(currentActivePet ?? (ownedIds.includes(DEFAULT_PET) ? DEFAULT_PET : ownedIds[0]) ?? null);
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
      try {
        await (supabase as any)
          .from("pet_collection")
          .insert({ user_id: user.id, pet_id: petId });
      } catch {}
    }
  }, [petCollection, user]);

  const triggerReaction = useCallback((type: ReactionType, durationMs?: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setReaction(type);
    setIsCompanionVisible(true);

    const duration = durationMs ?? (type === "perfect" ? PERFECT_DURATION : 3000);
    timerRef.current = setTimeout(() => setReaction("idle"), duration);
  }, []);

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
