import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Loader2, AlertCircle, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePet } from "@/contexts/PetContext";
import { getPetById } from "@/lib/pets";
import { Button } from "@/components/ui/button";

type RpcFn = (
  fn: string,
  args?: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

type Status = "loading" | "ready" | "claiming" | "success" | "error" | "need_auth";

const ERROR_COPY: Record<string, string> = {
  not_found: "This Pro link doesn't exist.",
  already_claimed: "This Pro link has already been redeemed.",
  expired: "This Pro link has expired.",
  not_signed_in: "Please sign in to redeem your Pro access.",
};

export default function ProGiftClaim() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activePet, triggerReaction } = usePet();
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [days, setDays] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const pet = getPetById(activePet ?? "") ?? null;

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No gift token provided.");
      return;
    }
    if (authLoading) return;
    (async () => {
      const { data, error } = await (supabase.rpc as unknown as RpcFn)("preview_pro_gift_link", {
        _token: token,
      });
      const row = data as
        | { error?: string; days?: number | null; claimed?: boolean; expired?: boolean }
        | null;
      if (error || !row || row.error) {
        setStatus("error");
        setErrorMsg(ERROR_COPY[row?.error ?? ""] ?? error?.message ?? "Something went wrong.");
        return;
      }
      if (row.claimed) {
        setStatus("error");
        setErrorMsg(ERROR_COPY.already_claimed);
        return;
      }
      if (row.expired) {
        setStatus("error");
        setErrorMsg(ERROR_COPY.expired);
        return;
      }
      setDays(row.days ?? null);
      setStatus(user ? "ready" : "need_auth");
    })();
  }, [token, authLoading, user]);

  const celebrate = async () => {
    triggerReaction("celebrate", 6000);
    try {
      const confetti = (await import("canvas-confetti")).default;
      const burst = (originY: number) =>
        confetti({ particleCount: 140, spread: 85, origin: { y: originY } });
      burst(0.45);
      window.setTimeout(() => burst(0.6), 350);
      window.setTimeout(() => burst(0.5), 700);
    } catch {
      /* confetti is decorative */
    }
  };

  const claim = async () => {
    if (!user) {
      navigate(`/auth?next=${encodeURIComponent(`/pro-gift?token=${token}`)}`);
      return;
    }
    setStatus("claiming");
    const { data, error } = await (supabase.rpc as unknown as RpcFn)("claim_pro_gift_link", {
      _token: token,
    });
    const payload = data as { ok?: boolean; error?: string; days?: number | null } | null;
    if (error || payload?.error || !payload?.ok) {
      setStatus("error");
      setErrorMsg(ERROR_COPY[payload?.error ?? ""] ?? error?.message ?? "Couldn't redeem this link.");
      return;
    }
    setDays(payload.days ?? null);
    setStatus("success");
    void celebrate();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative z-10 glass-panel-strong p-8 max-w-sm w-full text-center space-y-5"
      >
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
            <p className="text-muted-foreground">Checking your gift…</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-foreground">{errorMsg}</p>
            <Button variant="glass" onClick={() => navigate("/discover")}>
              Back to LinguaScript
            </Button>
          </div>
        )}

        {(status === "ready" || status === "need_auth" || status === "claiming") && (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Crown className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">You've been gifted Pro</h1>
            <p className="text-muted-foreground text-sm">
              {days ? `${days} days` : "Lifetime"} of LinguaScript Pro — unlimited languages,
              flashcards and priority translations.
            </p>
            <Button
              variant="hero"
              size="lg"
              className="w-full gap-2"
              onClick={claim}
              disabled={status === "claiming"}
            >
              {status === "claiming" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PartyPopper className="w-4 h-4" />
              )}
              {status === "need_auth" ? "Sign in to redeem" : "Redeem my Pro access"}
            </Button>
          </>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="text-6xl"
            >
              {pet?.emoji ?? "🎉"}
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground">Pro unlocked!</h1>
            <p className="text-muted-foreground text-sm">
              {pet ? `${pet.name} is celebrating with you. ` : ""}
              You now have {days ? `${days} days` : "lifetime"} of LinguaScript Pro.
            </p>
            <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/discover")}>
              Start learning
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
