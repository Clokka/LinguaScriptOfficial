import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Search, Check, X, Loader2, Link, Copy } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface GiftPetModalProps {
  open: boolean;
  onClose: () => void;
  petId: string;
}

type Method = "username" | "link";
type Step = "choose" | "search" | "confirm" | "done" | "link_ready";

export function GiftPetModal({ open, onClose, petId }: GiftPetModalProps) {
  const { toast } = useToast();
  const pet = getPetById(petId);
  const [method, setMethod] = useState<Method>("username");
  const [step, setStep] = useState<Step>("choose");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [giftLink, setGiftLink] = useState<string | null>(null);

  const handleReset = () => {
    setStep("choose");
    setUsername("");
    setGiftLink(null);
    setMethod("username");
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSelectMethod = (m: Method) => {
    setMethod(m);
    setStep(m === "username" ? "search" : "search");
    if (m === "link") generateLink();
  };

  const generateLink = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("create_gift_link", { p_pet_id: petId });
    setLoading(false);

    if (error || (data as any)?.error) {
      toast({ title: "Couldn't create link", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }

    const token = (data as any).token;
    const url = `${window.location.origin}/gift?token=${token}`;
    setGiftLink(url);
    setStep("link_ready");
  };

  const copyLink = () => {
    if (!giftLink) return;
    navigator.clipboard.writeText(giftLink);
    toast({ title: "Link copied!", description: "Share it with your friend." });
  };

  const handleConfirm = async () => {
    if (!username.trim()) return;
    setLoading(true);

    const { data, error } = await (supabase.rpc as any)("gift_pet", {
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
            Gift {pet.emoji} {pet.name}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">

          {/* Step 1: Choose method */}
          {step === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground">How do you want to send the gift?</p>
              <button
                onClick={() => handleSelectMethod("username")}
                className={cn(
                  "w-full rounded-xl border p-4 text-left flex items-center gap-3 transition-all",
                  "border-border/50 hover:border-primary/50 hover:bg-primary/5"
                )}
              >
                <Search className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">By username</p>
                  <p className="text-xs text-muted-foreground">Search for a friend directly</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectMethod("link")}
                className={cn(
                  "w-full rounded-xl border p-4 text-left flex items-center gap-3 transition-all",
                  "border-border/50 hover:border-primary/50 hover:bg-primary/5"
                )}
              >
                <Link className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Share a gift link</p>
                  <p className="text-xs text-muted-foreground">Anyone with the link can claim it</p>
                </div>
              </button>
              <Button variant="outline" className="w-full mt-1" onClick={handleClose}>
                Cancel
              </Button>
            </motion.div>
          )}

          {/* Username: search */}
          {step === "search" && method === "username" && (
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
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setStep("choose")}>
                  <X className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button variant="hero" className="flex-1" disabled={!username.trim()} onClick={() => setStep("confirm")}>
                  Next
                </Button>
              </div>
            </motion.div>
          )}

          {/* Username: confirm */}
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
                <Button variant="hero" className="flex-1 gap-1.5" onClick={handleConfirm} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  Send Gift
                </Button>
              </div>
            </motion.div>
          )}

          {/* Username: done */}
          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-2"
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
              <Button variant="hero" className="w-full" onClick={handleClose}>Done</Button>
            </motion.div>
          )}

          {/* Link: generating */}
          {step === "search" && method === "link" && (
            <motion.div
              key="link-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-6"
            >
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Creating gift link…</p>
            </motion.div>
          )}

          {/* Link: ready to share */}
          {step === "link_ready" && giftLink && (
            <motion.div
              key="link_ready"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="rounded-xl bg-secondary/50 p-4 text-center">
                <div className="text-3xl mb-2">{pet.emoji}</div>
                <p className="text-sm text-foreground font-medium">Gift link ready!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Anyone who opens this link gets {pet.name}. Single-use, expires in 30 days.
                </p>
              </div>

              <div className="flex gap-2 items-center rounded-xl bg-secondary/40 border border-border p-2 pl-3">
                <p className="text-xs text-muted-foreground truncate flex-1 font-mono">
                  {giftLink.replace("https://", "")}
                </p>
                <Button size="sm" variant="hero" className="gap-1.5 flex-shrink-0" onClick={copyLink}>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("choose")}>
                  New gift
                </Button>
                <Button variant="hero" className="flex-1" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
