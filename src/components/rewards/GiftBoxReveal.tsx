import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gem } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GiftUnboxScene, type GiftUnboxHandle } from "@/components/pets/GiftUnboxScene";

const CHAMELEON_GLB = "/pets/Chameleon_Animations.glb";

export interface GiftContents {
  title: string;
  gems: number;
  item?: { name: string; emoji: string } | null;
}

/** Tap-to-open gift box. `onOpen` runs the server claim; the reveal shows
 *  what was actually granted. */
export function GiftBoxReveal({
  open,
  onClose,
  contents,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  contents: GiftContents | null;
  onOpen: () => Promise<void>;
}) {
  const [stage, setStage] = useState<"closed" | "opening" | "open">("closed");
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setStage("opening");
    setError(null);
    try {
      await Promise.all([onOpen(), new Promise((r) => setTimeout(r, 900))]);
      setStage("open");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't open the gift");
      setStage("closed");
    }
  };

  const close = () => {
    setStage("closed");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm text-center">
        <DialogTitle className="text-sm uppercase tracking-widest text-muted-foreground">
          {contents?.title}
        </DialogTitle>
        <div className="h-44 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {stage !== "open" ? (
              <motion.button
                key="box"
                onClick={stage === "closed" ? handleOpen : undefined}
                className="w-28 h-28 rounded-3xl bg-primary/15 border border-primary/40 flex items-center justify-center"
                animate={
                  stage === "opening"
                    ? { rotate: [0, -12, 12, -12, 12, 0], scale: [1, 1.1, 1.1, 1.15, 1.2, 0.2] }
                    : { y: [0, -6, 0] }
                }
                transition={stage === "opening" ? { duration: 0.9 } : { repeat: Infinity, duration: 1.6 }}
                exit={{ opacity: 0 }}
              >
                <Gift className="w-14 h-14 text-primary" />
              </motion.button>
            ) : (
              <motion.div
                key="reveal"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
                className="space-y-3"
              >
                {contents?.item && <div className="text-6xl">{contents.item.emoji}</div>}
                {contents?.item && <p className="font-bold text-foreground">{contents.item.name}</p>}
                {!!contents?.gems && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2">
                    <Gem className="w-4 h-4 text-accent" />
                    <span className="font-bold tabular-nums">+{contents.gems} Gems</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {stage === "open" ? (
          <Button onClick={close} className="w-full">Nice!</Button>
        ) : (
          <Button onClick={handleOpen} disabled={stage === "opening"} className="w-full">
            {stage === "opening" ? "Opening…" : "Tap to open"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
