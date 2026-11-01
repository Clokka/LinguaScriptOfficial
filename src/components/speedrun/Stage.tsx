// Full-screen dark "stage" for Speed Run lessons, styled after the brand reel
// (src/remotion/LaunchReel.tsx): near-black #08080B, Inter, deck-colour glow,
// spring-in / blur-out step transitions. Respects prefers-reduced-motion.
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX, X } from "lucide-react";
import { playSfx, setSfxEnabled, sfxEnabled } from "@/lib/sfx";
import { hasSpeechSynthesis, speakViaCloud } from "@/lib/cloudSpeech";

export const STAGE_BG = "#08080B";
const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Say a word or sentence in the learning language (device voice, else cloud). */
export function speak(text: string, lang: string) {
  if (!hasSpeechSynthesis()) { void speakViaCloud(text); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch { void speakViaCloud(text); }
}

export function Stage({ tint, step, steps, onClose, onSkip, children }: {
  tint: string;
  step: string;
  steps: string[];
  onClose: () => void;
  onSkip?: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [sound, setSound] = useState(sfxEnabled());
  const at = Math.max(0, steps.indexOf(step));

  // A soft whoosh on every step change (not on first open).
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) { setFirst(false); return; }
    playSfx("whoosh");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Lock the page behind the stage.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden text-white" style={{ background: STAGE_BG, fontFamily: FONT }}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ background: `radial-gradient(60% 45% at 50% 30%, ${tint}33 0%, ${tint}0d 45%, transparent 75%)` }}
        transition={{ duration: reduce ? 0 : 0.9, ease: "easeInOut" }}
      />
      <header className="relative z-10 flex items-center gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {steps.map((s, i) => (
            <motion.span
              key={s}
              className="h-1.5 rounded-full"
              animate={{ width: i === at ? 28 : 8, backgroundColor: i <= at ? tint : "rgba(255,255,255,.18)" }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          ))}
        </div>
        <button
          onClick={() => { const on = !sound; setSound(on); setSfxEnabled(on); if (on) playSfx("tap"); }}
          aria-label={sound ? "Mute sounds" : "Turn sounds on"}
          className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </header>
      <main className="relative z-10 flex-1 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-xl py-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, filter: "blur(10px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -18, filter: "blur(8px)" }}
              transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 28 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
          {onSkip && (
            <div className="mt-6 text-center">
              <button onClick={onSkip} className="text-sm text-white/40 underline-offset-4 hover:text-white/70 hover:underline">Skip</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** Big rounded primary button used on the stage. */
export function StageButton({ children, onClick, tint, disabled }: { children: ReactNode; onClick: () => void; tint: string; disabled?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      disabled={disabled}
      onClick={() => { playSfx("tap"); onClick(); }}
      className="mt-6 w-full rounded-2xl px-6 py-4 text-base font-bold text-black shadow-lg transition disabled:opacity-40"
      style={{ background: tint, boxShadow: `0 10px 40px -10px ${tint}` }}
    >
      {children}
    </motion.button>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{children}</p>;
}
