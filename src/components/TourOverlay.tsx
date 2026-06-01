import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MousePointer2 } from "lucide-react";
import { useTour } from "@/contexts/TourContext";
import { TOUR_PASTE_DEMO_URL } from "@/lib/tourSteps";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const Z_DIM = 100000;
const Z_RING = 100001;
const Z_TOOLTIP = 100002;
const Z_CURSOR = 100003;

export const TourOverlay = () => {
  const { active, step, advance, end, getPlayer } = useTour();
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<Rect | null>(null);
  const [cursorRect, setCursorRect] = useState<Rect | null>(null);
  const advanceLockRef = useRef(false);

  // Resolve target element (poll). Preserve last rect on transient nulls so the
  // cursor never snaps to screen center during page navigations.
  useEffect(() => {
    if (!active || !step) {
      setRect(null);
      setCursorRect(null);
      return;
    }
    let raf = 0;
    let cancelled = false;
    let missCount = 0;

    const measure = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        missCount = 0;
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      } else {
        missCount++;
        if (missCount > 30) setRect(null);
      }
      const cursorSel = (step as any).cursorSelector as string | undefined;
      const cEl = cursorSel
        ? (document.querySelector(cursorSel) as HTMLElement | null)
        : el;
      if (cEl) {
        const r = cEl.getBoundingClientRect();
        setCursorRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      }
      if (!cancelled) raf = requestAnimationFrame(measure);
    };
    measure();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, step]);

  // Auto-play training video so subtitles appear for the word step.
  useEffect(() => {
    if (!active || !step) return;
    if (step.id === "watch-word") {
      const tryPlay = () => {
        try {
          const p = getPlayer();
          if (p?.playVideo) p.playVideo();
        } catch {
          /* noop */
        }
      };
      tryPlay();
      const t = setInterval(tryPlay, 500);
      return () => clearInterval(t);
    }
  }, [active, step, getPlayer]);

  // Click-to-advance: capture-phase document listener.
  useEffect(() => {
    if (!active || !step) return;
    if (step.autoAction || step.expectRoute) return;

    const handler = (e: MouseEvent) => {
      if (advanceLockRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const matched = target.closest(step.selector);
      const isAllowed = target.closest('[data-tour-allow="true"]');
      if (matched) {
        // Fullscreen step: don't advance here — wait for the real
        // fullscreenchange event so we only advance once the browser
        // has actually entered fullscreen. This also lets the button's
        // native onClick (real user gesture) trigger fullscreen reliably.
        if (step.id === "watch-fullscreen") return;
        advanceLockRef.current = true;
        setTimeout(() => {
          advanceLockRef.current = false;
          if (step.navigateTo) navigate(step.navigateTo);
          advance();
        }, step.postDelay ?? 60);
      } else if (!step.allowFreeClicks && !isAllowed) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [active, step, advance, navigate]);

  // Route-change advance for steps that expect navigation.
  useEffect(() => {
    if (!active || !step) return;
    if (step.expectRoute && location.pathname === step.expectRoute) {
      const t = setTimeout(() => advance(), 350);
      return () => clearTimeout(t);
    }
  }, [location.pathname, active, step, advance]);

  // Auto actions.
  useEffect(() => {
    if (!active || !step) return;
    if (step.autoAction === "fill-paste-url") {
      const el = document.querySelector(step.selector) as HTMLInputElement | null;
      if (!el) return;
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      let i = 0;
      const url = TOUR_PASTE_DEMO_URL;
      const tick = setInterval(() => {
        i++;
        setter?.call(el, url.slice(0, i));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        if (i >= url.length) {
          clearInterval(tick);
          setTimeout(() => advance(), 1200);
        }
      }, 35);
      return () => clearInterval(tick);
    }
    if (step.autoAction === "finish") {
      const t = setTimeout(() => end(), 2400);
      return () => clearTimeout(t);
    }
  }, [active, step, advance, end]);

  // Reliable fullscreen step: advance & navigate when fullscreen actually opens,
  // even if the user's first click missed the small icon button.
  useEffect(() => {
    if (!active || !step) return;
    if (step.id !== "watch-fullscreen") return;
    const handler = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (!fsEl) return;
      // Give the user a beat to feel the fullscreen, then exit + navigate back to /browse.
      setTimeout(() => {
        try {
          if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
          else if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          }
        } catch { /* noop */ }
        if (step.navigateTo) navigate(step.navigateTo);
        advance();
      }, 1400);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, [active, step, advance, navigate]);

  if (!active || !step) return null;

  const pad = step.pad ?? 8;
  const ring = rect
    ? {
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Cursor target = center of cursorRect (which may differ from spotlight).
  const cursorPos = cursorRect
    ? { left: cursorRect.left + cursorRect.width * 0.5, top: cursorRect.top + cursorRect.height * 0.5 }
    : ring
      ? { left: ring.left + ring.width * 0.5, top: ring.top + ring.height * 0.5 }
      : { left: window.innerWidth / 2, top: window.innerHeight / 2 };

  // Tooltip placement.
  let tooltipStyle: React.CSSProperties = { zIndex: Z_TOOLTIP, position: "fixed", maxWidth: 280 };
  if (ring) {
    const placement = step.placement || "bottom";
    if (placement === "bottom") {
      tooltipStyle = { ...tooltipStyle, left: ring.left + ring.width / 2, top: ring.top + ring.height + 16, transform: "translateX(-50%)" };
    } else if (placement === "top") {
      tooltipStyle = { ...tooltipStyle, left: ring.left + ring.width / 2, top: ring.top - 16, transform: "translate(-50%, -100%)" };
    } else if (placement === "right") {
      tooltipStyle = { ...tooltipStyle, left: ring.left + ring.width + 16, top: ring.top + ring.height / 2, transform: "translateY(-50%)" };
    } else {
      tooltipStyle = { ...tooltipStyle, left: ring.left - 16, top: ring.top + ring.height / 2, transform: "translate(-100%, -50%)" };
    }
  } else {
    tooltipStyle = { ...tooltipStyle, left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <>
      {/* Spotlight via box-shadow trick */}
      {ring && (
        <motion.div
          initial={false}
          animate={{ left: ring.left, top: ring.top, width: ring.width, height: ring.height }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          style={{
            position: "fixed",
            zIndex: Z_DIM,
            borderRadius: 14,
            pointerEvents: "none",
            boxShadow: "0 0 0 9999px rgba(15, 12, 25, 0.62)",
          }}
        />
      )}
      {!ring && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z_DIM,
            background: "rgba(15, 12, 25, 0.62)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Glowing ring */}
      {ring && (
        <motion.div
          initial={false}
          animate={{ left: ring.left, top: ring.top, width: ring.width, height: ring.height }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          style={{
            position: "fixed",
            zIndex: Z_RING,
            borderRadius: 14,
            pointerEvents: "none",
            boxShadow:
              "0 0 0 2px rgba(249,115,22,0.95), 0 0 0 6px rgba(249,115,22,0.35), 0 0 32px 4px rgba(249,115,22,0.55)",
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          style={tooltipStyle}
          className="rounded-2xl bg-white shadow-2xl border border-orange-200 px-4 py-3 text-[14px] text-neutral-800 leading-snug font-medium"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-orange-500">●</span>
            <span>{step.copy}</span>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Animated fake cursor */}
      <motion.div
        initial={false}
        animate={{ left: cursorPos.left, top: cursorPos.top }}
        transition={{ type: "spring", stiffness: 55, damping: 16, mass: 1.1 }}
        style={{ position: "fixed", zIndex: Z_CURSOR, pointerEvents: "none" }}
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{ transform: "translate(-6px, -6px)" }}
        >
          <MousePointer2
            className="w-7 h-7 text-white drop-shadow-[0_2px_10px_rgba(249,115,22,0.95)]"
            fill="rgb(249,115,22)"
          />
        </motion.div>
      </motion.div>

    </>
  );
};

