import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Search, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getPetById } from "@/lib/pets";

interface GiftPetModalProps {
  open: boolean;
  onClose: () => void;
  petId: string;
}

type Step = "search" | "confirm" | "done";

export function GiftPetModal({ open, onClose, petId }: GiftPetModalProps) {
  const { toast } = useToast();
  const pet = getPetById(petId);
  const [step, setStep] = useState<Step>("search");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = () => {
    setStep("search");
    setUsername("");
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleConfirm = async () => {
    if (!username.trim()) return;
    setLoading(true);

    const { data, error } = await supabase.rpc("gift_pet", {
      p_recipient_username: username.trim(),
      p_pet_id: petId,
    });

    setLoading(false);

    if (error || (data as any)?.error) {
      const msg = (data as any)?.error ?? error?.message ?? "Something went wrong";
      toast({ title: "Gift failed", description: msg, variant: "destructive" });
      return;
    }

    setStep("done");
  };

  if (!pet) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm glass-panel-strong">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Gift className="w-5 h-5 text-primary" />
            Gift {pet.name}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Enter your friend's username to gift them{" "}
                <span className="text-foreground font-medium">{pet.emoji} {pet.name}</span>.
                You keep your copy too.
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && username.trim() && setStep("confirm")}
                  placeholder="Username…"
                  className="pl-9 bg-secondary/50 border-border"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  disabled={!username.trim()}
                  onClick={() => setStep("confirm")}
                >
                  Next
                </Button>
              </div>
            </motion.div>
          )}

          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="rounded-xl bg-secondary/50 p-4 text-center space-y-1">
                <div className="text-4xl mb-2">{pet.emoji}</div>
                <p className="text-foreground font-medium text-sm">
                  Gift <strong>{pet.name}</strong> to <strong>{username}</strong>?
                </p>
                <p className="text-muted-foreground text-xs">
                  They'll receive {pet.name} in their collection. You keep yours.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setStep("search")}>
                  <X className="w-4 h-4" /> Back
                </Button>
                <Button
                  variant="hero"
                  className="flex-1 gap-1.5"
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Gift className="w-4 h-4" />
                  )}
                  Send Gift
                </Button>
              </div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-4"
            >
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-semibold">Gift sent!</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {pet.emoji} {pet.name} is now in {username}'s collection.
                </p>
              </div>
              <Button variant="hero" className="w-full" onClick={handleClose}>
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
