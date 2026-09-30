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
  const [ready, setReady] = useState(false);
  const sceneRef = useRef<GiftUnboxHandle>(null);

  const handleOpen = async () => {
    if (stage !== "closed") return;
    setStage("opening");
    setError(null);
    sceneRef.current?.open();
    try {
      await Promise.all([onOpen(), new Promise((r) => setTimeout(r, 2400))]);
      setStage("open");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't open the gift");
      setStage("closed");
    }
  };

  const close = () => {
    setStage("closed");
    setReady(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm text-center">
        <DialogTitle className="text-sm uppercase tracking-widest text-muted-foreground">
          {contents?.title}
        </DialogTitle>
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleOpen}
            aria-label="Open gift"
            className="outline-none"
          >
            <GiftUnboxScene
              key={open ? "scene-open" : "scene-closed"}
              ref={sceneRef}
              petGlb={CHAMELEON_GLB}
              size={260}
              onReady={() => setReady(true)}
            />
          </button>
        </div>
        <AnimatePresence>
          {stage === "open" && (
            <motion.div
              key="reveal"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="space-y-2"
            >
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        {stage === "open" ? (
          <Button onClick={close} className="w-full">Nice!</Button>
        ) : (
          <Button onClick={handleOpen} disabled={stage === "opening" || !ready} className="w-full">
            {stage === "opening" ? "Opening…" : ready ? "Tap to open" : "Loading…"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
