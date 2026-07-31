import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

/**
 * Pointer-magnetic button. The element leans toward the cursor while it's
 * nearby and springs back on leave.
 *
 * Uses gsap.quickTo rather than gsap.to per pointermove — quickTo reuses one
 * tween instead of allocating a new one on every event, which is the
 * difference between smooth and janky on a pointer-rate handler.
 *
 * Disabled entirely for coarse pointers (no hover to respond to) and for
 * users who ask for reduced motion.
 */
interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** How far the element may travel from rest, in px. */
  strength?: number;
}

export const MagneticButton = ({
  strength = 14,
  className,
  children,
  ...props
}: MagneticButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3.out" });

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      xTo(gsap.utils.clamp(-1, 1, dx) * strength);
      yTo(gsap.utils.clamp(-1, 1, dy) * strength);
    };
    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(el);
    };
  }, [strength]);

  return (
    <button ref={ref} className={cn("will-change-transform", className)} {...props}>
      {children}
    </button>
  );
};

export default MagneticButton;
