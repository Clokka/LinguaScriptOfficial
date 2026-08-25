import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GiftUnboxScene, type GiftUnboxHandle } from "@/components/pets/GiftUnboxScene";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { DECK } from "@/lib/deck-colors";

/**
 * Pro + Chameleon giveaway (separate from the one-time chameleon gift).
 *
 * A single reusable link: unlimited people can claim it. The present opens for
 * everyone; keeping the chameleon + lifetime Pro requires an account. Claims are
 * recorded in pro_chameleon_claims so admins can see every redeemer.
 */
const PET_GLB = "/pets/Chameleon_Animations.glb";

type RpcFn = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

type Phase = "loading" | "invalid" | "closed" | "opening" | "opened" | "claiming" | "claimed";

const ERROR_COPY: Record<string, string> = {
  not_found: "This giveaway link doesn't exist.",
  inactive: "This giveaway has ended.",
  not_signed_in: "Please create an account to claim your gift.",
};

export default function ProChameleonClaim() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const token = params.get("token") ?? "";

  const sceneRef = useRef<GiftUnboxHandle>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState("");

  const returnTo = `/pro-chameleon?token=${token}&claim=1`;

  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      setError("No giveaway token provided.");
      return;
    }
    (async () => {
      const { data, error: rpcError } = await (supabase.rpc as unknown as RpcFn)(
        "preview_pro_chameleon_link",
        { _token: token },
      );
      const row = data as { ok?: boolean; error?: string; label?: string | null } | null;
      if (rpcError || !row?.ok) {
        setPhase("invalid");
        setError(ERROR_COPY[row?.error ?? ""] ?? rpcError?.message ?? "Something went wrong.");
        return;
      }
      setLabel(row.label ?? null);
      setPhase("closed");
    })();
  }, [token]);

  const claim = async () => {
    setPhase("claiming");
    setError("");
    const { data, error: rpcError } = await (supabase.rpc as unknown as RpcFn)(
      "claim_pro_chameleon_link",
      { _token: token },
    );
    const result = data as { ok?: boolean; error?: string } | null;
    if (rpcError || !result?.ok) {
      setPhase("opened");
      setError(ERROR_COPY[result?.error ?? ""] ?? rpcError?.message ?? "Couldn't claim this gift.");
      return;
    }
    setPhase("claimed");
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.5 } });
      window.setTimeout(() => confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } }), 350);
    } catch {
      /* decorative */
    }
  };

  // Returning from auth with ?claim=1 — finish the claim automatically.
  useEffect(() => {
    if (authLoading || !user || !token) return;
    if (params.get("claim") !== "1") return;
    if (phase === "loading" || phase === "invalid") return;
    void claim().then(() => {
      params.delete("claim");
      setParams(params, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token, phase === "loading"]);

  const open = () => {
    if (phase !== "closed") return;
    setPhase("opening");
    sceneRef.current?.open?.();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <div className="relative z-10 w-full max-w-md text-center">
        {phase === "loading" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
            <p className="text-muted-foreground">Checking your gift…</p>
          </div>
        )}

        {phase === "invalid" && (
          <div className="glass-panel-strong p-8 flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-foreground">{error}</p>
            <MagneticButton
              onClick={() => navigate("/discover")}
              className="px-6 py-3 rounded-xl font-semibold text-[#08080B]"
              style={{ backgroundColor: DECK.green }}
            >
              Back to LinguaScript
            </MagneticButton>
          </div>
        )}

        {phase !== "loading" && phase !== "invalid" && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground mb-4">
              {label ?? "A gift for you"}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1] mb-4 text-foreground">
              The chameleon + lifetime Pro.
              <br />
              <span style={{ color: DECK.green }}>Both free.</span>
            </h1>

            <div
              className="mx-auto mb-6 flex items-center justify-center"
              role="button"
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
              style={{ cursor: phase === "closed" ? "pointer" : "default", width: 300, height: 300 }}
            >
              <GiftUnboxScene
                ref={sceneRef}
                petGlb={PET_GLB}
                size={300}
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

              {(phase === "opened" || phase === "claiming") && (
                <motion.div
                  key="claim"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <p className="text-muted-foreground">
                    Get Pro <span className="text-foreground font-semibold">and</span> the chameleon
                    for free — click here.
                  </p>
                  <MagneticButton
                    onClick={() =>
                      user
                        ? claim()
                        : navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`)
                    }
                    disabled={phase === "claiming"}
                    className="px-8 py-4 rounded-xl font-bold text-lg text-[#08080B] disabled:opacity-60 inline-flex items-center gap-2"
                    style={{ backgroundColor: DECK.green }}
                  >
                    <Crown className="w-5 h-5" />
                    {phase === "claiming"
                      ? "Unlocking…"
                      : user
                        ? "Claim Pro + my chameleon"
                        : "Create a free account to claim"}
                  </MagneticButton>
                  <p className="text-xs text-muted-foreground">
                    Lifetime Pro · No card required
                  </p>
                </motion.div>
              )}

              {phase === "claimed" && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                    <Crown className="w-3.5 h-3.5" /> Pro member
                  </div>
                  <p className="text-lg font-semibold" style={{ color: DECK.green }}>
                    Lifetime Pro unlocked and the chameleon is yours.
                  </p>
                  <MagneticButton
                    onClick={() => navigate("/discover")}
                    className="px-8 py-4 rounded-xl font-bold text-lg text-[#08080B]"
                    style={{ backgroundColor: DECK.green }}
                  >
                    Start learning
                  </MagneticButton>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p className="mt-4 text-sm" style={{ color: DECK.red }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
