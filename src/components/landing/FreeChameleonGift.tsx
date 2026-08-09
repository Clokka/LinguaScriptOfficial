import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GiftUnboxScene, type GiftUnboxHandle } from "@/components/pets/GiftUnboxScene";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DECK } from "@/lib/deck-colors";
import { MagneticButton } from "@/components/landing/MagneticButton";

/**
 * The free chameleon.
 *
 * Delight first, friction second: the present opens and the chameleon appears
 * for anyone, signed in or not. Only keeping him requires an account.
 *
 * Reuses GiftUnboxScene (Present.glb + confetti) rather than recreating the
 * unboxing, and claims through the claim_free_pet RPC, which is idempotent and
 * records a pet_gift_links row so the gift shows up in /admin.
 */
const PET_ID = "chameleon";
const PET_GLB = "/pets/Chameleon_Animations.glb";
/** Auth bounces back here so the claim can finish after sign-up. */
const RETURN_TO = "/thechameleonmethod?claim=chameleon";

type Phase = "closed" | "opening" | "opened" | "claimed";

export const FreeChameleonGift = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const sceneRef = useRef<GiftUnboxHandle>(null);
  const [phase, setPhase] = useState<Phase>("closed");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    setClaiming(true);
    setError(null);
    const { data, error: rpcError } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("claim_free_pet", { p_pet_id: PET_ID });

    setClaiming(false);
    const result = data as { ok?: boolean; error?: string } | null;

    if (rpcError || result?.error) {
      setError(result?.error ?? rpcError?.message ?? "Something went wrong.");
      return;
    }
    setPhase("claimed");
  };

  // Returning from auth with ?claim=chameleon — finish what they started.
  useEffect(() => {
    if (authLoading || !user) return;
    if (params.get("claim") !== PET_ID) return;
    setPhase("opened");
    void claim().then(() => {
      // Drop the param so a refresh doesn't re-run the claim.
      params.delete("claim");
      setParams(params, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const open = () => {
    if (phase !== "closed") return;
    setPhase("opening");
    sceneRef.current?.open?.();
  };

  return (
    <div className="text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-4">
        A gift to start with
      </p>
      <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-4">
        Take the chameleon.
        <br />
        <span style={{ color: DECK.green }}>He's free.</span>
      </h2>
      <p className="text-white/45 max-w-md mx-auto mb-10">
        Your companion wears your progress — red when a scene is full of
        strangers, green once you've earned it.
      </p>

      <div
        className="mx-auto mb-8 flex items-center justify-center"
        data-cursor="hot"
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
        style={{ cursor: phase === "closed" ? "pointer" : "default", width: 320, height: 320 }}
      >
        <GiftUnboxScene
          ref={sceneRef}
          petGlb={PET_GLB}
          size={320}
          onOpenComplete={() => setPhase((p) => (p === "opening" ? "opened" : p))}
        />
      </div>

      <AnimatePresence mode="wait">
        {phase === "closed" && (
          <motion.div key="cta" exit={{ opacity: 0, y: -8 }}>
            <MagneticButton
              onClick={open}
              className="px-8 py-4 rounded-xl font-bold text-lg text-[#08080B]"
              style={{ backgroundColor: DECK.green }}
            >
              Open your gift
            </MagneticButton>
          </motion.div>
        )}

        {phase === "opened" && !user && (
          <motion.div
            key="signup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <p className="text-white/70">Create a free account to keep him.</p>
            <MagneticButton
              onClick={() => navigate(`/auth?redirect=${encodeURIComponent(RETURN_TO)}`)}
              className="px-8 py-4 rounded-xl font-bold text-lg text-[#08080B]"
              style={{ backgroundColor: DECK.green }}
            >
              Keep my chameleon
            </MagneticButton>
            <p className="text-xs text-white/30">Free forever · No card required</p>
          </motion.div>
        )}

        {phase === "opened" && user && (
          <motion.div key="claim" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <MagneticButton
              onClick={claim}
              disabled={claiming}
              className="px-8 py-4 rounded-xl font-bold text-lg text-[#08080B] disabled:opacity-60"
              style={{ backgroundColor: DECK.green }}
            >
              {claiming ? "Adding to your collection…" : "Add him to my collection"}
            </MagneticButton>
          </motion.div>
        )}

        {phase === "claimed" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <p className="text-lg font-semibold" style={{ color: DECK.green }}>
              He's yours.
            </p>
            <button
              onClick={() => navigate("/profile")}
              className="text-sm text-white/50 underline underline-offset-4 hover:text-white transition-colors"
            >
              See him in your collection
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-4 text-sm" style={{ color: DECK.red }}>{error}</p>}
    </div>
  );
};

export default FreeChameleonGift;
