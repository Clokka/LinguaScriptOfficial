import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GiftUnboxScene, type GiftUnboxHandle } from "@/components/pets/GiftUnboxScene";

const CHAMELEON_GLB = "/pets/Chameleon_Animations.glb";
// If the 3D scene can't load (no WebGL, slow network), offer a plain button
// after this long so the learner is never stuck in front of an unopenable gift.
const FALLBACK_MS = 6000;

export interface GiftContents {
  title: string;
  gems: number;
  item?: { name: string; emoji: string } | null;
}

/**
 * Full-screen 3D gift. Nothing to read and no button: the learner taps the
 * gift itself to open it, and it can't be dismissed until it's opened.
 * `onOpen` runs the server claim; the reveal shows what was actually granted.
 */
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
  const [fallback, setFallback] = useState(false);
  const sceneRef = useRef<GiftUnboxHandle>(null);
  const size = typeof window === "undefined" ? 320 : Math.round(Math.min(window.innerWidth * 0.86, 420));

  useEffect(() => {
    if (!open || ready) return;
    const t = setTimeout(() => setFallback(true), FALLBACK_MS);
    return () => clearTimeout(t);
  }, [open, ready]);

  const handleOpen = async () => {
    if (stage !== "closed") return;
    setStage("opening");
    setError(null);
    sceneRef.current?.open();
    try {
      await Promise.all([onOpen(), new Promise((r) => setTimeout(r, 2400))]);
      setStage("open");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the gift");
      setStage("closed");
    }
  };

  const close = () => {
    setStage("closed");
    setReady(false);
    setFallback(false);
    setError(null);
    onClose();
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // pointer-events: auto — an open Radix dialog (e.g. the rewards panel)
    // disables pointer events on everything outside it, including this portal.
    // A calm, happy morning-sky backdrop: soft sky blue into mint into warm
    // cream, with a sunny glow behind the gift — never a dark screen.
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[220] flex flex-col items-center justify-center overflow-hidden px-4"
      style={{ pointerEvents: "auto", background: "linear-gradient(180deg, #DDF1FF 0%, #E6FAEE 52%, #FFF3D9 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.95) 0%, rgba(255,236,170,0.45) 22%, transparent 48%)" }}
      />

      {contents?.title && (
        <motion.p
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="relative mb-1 text-3xl font-black tracking-tight text-slate-800"
        >
          {contents.title} 🎉
        </motion.p>
      )}

      <motion.button
        type="button"
        onClick={handleOpen}
        aria-label="Open your gift"
        disabled={stage !== "closed"}
        className="relative outline-none"
        animate={stage === "closed" && ready ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={stage === "closed" ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <GiftUnboxScene
          ref={sceneRef}
          petGlb={CHAMELEON_GLB}
          size={size}
          hideGround
          onReady={() => setReady(true)}
        />
        {/* Soft contact shadow instead of the 3D ground disc. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-slate-900/10 blur-md"
          style={{ bottom: size * 0.2, width: size * 0.42, height: size * 0.07 }}
        />
      </motion.button>

      <div className="relative mt-2 flex min-h-[7rem] flex-col items-center gap-3 text-center">
        <AnimatePresence mode="wait">
          {stage === "open" ? (
            <motion.div
              key="reveal"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="flex flex-col items-center gap-3"
            >
              {contents?.item && <p className="text-lg font-bold text-slate-800">{contents.item.emoji} {contents.item.name}</p>}
              {!!contents?.gems && (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/90 px-5 py-2.5 text-slate-800 shadow-sm">
                  <Gem className="h-5 w-5 text-amber-500" />
                  <span className="text-xl font-black tabular-nums">+{contents.gems}</span>
                </div>
              )}
              <Button onClick={close} size="lg" className="mt-1 rounded-full px-10">Nice!</Button>
            </motion.div>
          ) : stage === "closed" && ready ? (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="text-3xl"
              aria-hidden
            >
              👆
            </motion.p>
          ) : null}
        </AnimatePresence>
        {fallback && !ready && stage === "closed" && (
          <Button onClick={handleOpen} size="lg" className="rounded-full px-10">Open</Button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </motion.div>,
    document.body,
  );
}
