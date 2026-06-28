import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Gift, Check, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getPetById } from "@/lib/pets";
import { usePet } from "@/contexts/PetContext";

type Status = "loading" | "ready" | "claiming" | "success" | "error" | "already_owned" | "need_auth";

export default function GiftClaim() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { addToCollection, triggerReaction } = usePet();
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [petId, setPetId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Preview the link without claiming (fetch link metadata)
  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("No gift token provided."); return; }
    if (authLoading) return;

    const preview = async () => {
      const { data } = await supabase
        .from("pet_gift_links")
        .select("pet_id, claimed_by, expires_at")
        .eq("token", token)
        .single();

      if (!data) { setStatus("error"); setErrorMsg("Gift link not found."); return; }
      if (data.claimed_by) { setStatus("error"); setErrorMsg("This gift has already been claimed."); return; }
      if (new Date(data.expires_at) < new Date()) { setStatus("error"); setErrorMsg("This gift link has expired."); return; }

      setPetId(data.pet_id);

      if (!user) {
        setStatus("need_auth");
      } else {
        setStatus("ready");
      }
    };

    preview();
  }, [token, authLoading, user]);

  const handleClaim = async () => {
    if (!user) { navigate(`/auth?redirect=/gift?token=${token}`); return; }
    setStatus("claiming");

    const { data, error } = await supabase.rpc("claim_gift_link", { p_token: token });

    if (error || (data as any)?.error) {
      const msg = (data as any)?.error ?? error?.message ?? "Something went wrong";
      setErrorMsg(msg);
      setStatus("error");
      return;
    }

    const claimedPetId = (data as any).pet_id;
    if (claimedPetId) {
      await addToCollection(claimedPetId);
      setPetId(claimedPetId);
      triggerReaction("celebrate", 5000);
    }
    setStatus("success");
  };

  const pet = petId ? getPetById(petId) : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative z-10 glass-panel-strong p-8 max-w-sm w-full text-center"
      >
        {(status === "loading") && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Opening your gift…</p>
          </div>
        )}

        {(status === "ready" || status === "claiming" || status === "need_auth") && pet && (
          <div className="space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Gift className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm mb-1">You've been sent a gift</p>
              <div className="text-5xl my-3">{pet.emoji}</div>
              <h1 className="text-2xl font-bold text-foreground">{pet.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">{pet.description}</p>
            </div>

            {status === "need_auth" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Sign in to claim your {pet.name}.</p>
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate(`/auth?redirect=/gift?token=${token}`)}
                >
                  Sign in to claim
                </Button>
              </div>
            ) : (
              <Button
                variant="hero"
                size="lg"
                className="w-full gap-2"
                onClick={handleClaim}
                disabled={status === "claiming"}
              >
                {status === "claiming" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Gift className="w-4 h-4" />
                )}
                Claim {pet.name}
              </Button>
            )}
          </div>
        )}

        {status === "success" && pet && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-5xl">{pet.emoji}</div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{pet.name} is yours!</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Your new companion is waiting in your collection.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/profile")}>
                View in My Pet Collection
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => navigate("/")}>
                Start Learning
              </Button>
            </div>
          </motion.div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Couldn't claim gift</h1>
              <p className="text-muted-foreground text-sm mt-1">{errorMsg}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              Go to LinguaScript
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
