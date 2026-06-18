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
  const { active, step, advance, end, getPlayer, trainingFilmId } = useTour();
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<Rect | null>(null);
  const [cursorRect, setCursorRect] = useState<Rect | null>(null);
  const advanceLockRef = useRef(false);

  // Map a step id to the route where its target lives. Used to recover when
  // the user lands on the wrong page mid-tour so we can ferry them back
  // automatically instead of getting stuck (especially for the final
  // "paste a YouTube link" step on /browse).
  const expectedRouteForStep = (id: string): string | null => {
    if (id.startsWith("watch-")) return trainingFilmId ? `/watch/${trainingFilmId}` : null;
    if (id.startsWith("flashcards-") || id.startsWith("deck-") || id.startsWith("red-") || id.startsWith("orange-") || id.startsWith("green-")) return "/flashcards";
    if (id.startsWith("browse-") || id.startsWith("settings-") || id === "finale") return "/browse";
    return null;
  };

  // Stale-step recovery: if a step's target never appears, ferry the user
  // back to its expected route, then skip the step entirely as a last
  // resort. Guarantees the tour always reaches the final paste step.
  useEffect(() => {
    if (!active || !step) return;
    const startedAt = Date.now();
    let navigated = false;
    let skipped = false;
    const expected = expectedRouteForStep(step.id);
    const tick = setInterval(() => {
      if (rect) return; // target found, no recovery needed
      const elapsed = Date.now() - startedAt;
      if (!navigated && expected && location.pathname !== expected && elapsed > 4000) {
        navigated = true;
        navigate(expected);
      }
      if (!skipped && elapsed > 14000) {
        skipped = true;
        advance();
      }
    }, 800);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id, rect, location.pathname, trainingFilmId]);

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

    let scrolledForEl: Element | null = null;
    // Pick the FIRST visible element matching the selector. Many tour targets
    // exist twice in the DOM (desktop sidebar + mobile tab row) where one is
    // display:none on the current viewport. We must point the cursor at the
    // one the user can actually see and tap.
    const pickVisible = (sel: string): HTMLElement | null => {
      const all = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      for (const node of all) {
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return node;
      }
      return all[0] || null;
    };
    const measure = () => {
      const el = pickVisible(step.selector);
      if (el) {
        missCount = 0;
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
        // Auto-scroll target into view on small screens / when offscreen.
        if (el !== scrolledForEl) {
          const vh = window.innerHeight;
          const vw = window.innerWidth;
          const offscreen =
            r.top < 80 || r.bottom > vh - 120 || r.left < 0 || r.right > vw;
          if (offscreen) {
            try {
              el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
            } catch {
              el.scrollIntoView();
            }
          }
          scrolledForEl = el;
        }
      } else {
        missCount++;
        if (missCount > 30) setRect(null);
        scrolledForEl = null;
      }
      const cursorSel = (step as any).cursorSelector as string | undefined;
      const cEl = cursorSel ? pickVisible(cursorSel) : el;
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

    const handler = (e: MouseEvent | TouchEvent) => {
      if (advanceLockRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const matched = target.closest(step.selector);
      const isAllowed = target.closest('[data-tour-allow="true"]');
      if (matched) {
        if (step.id === "watch-fullscreen") return;
        advanceLockRef.current = true;
        setTimeout(() => {
          advanceLockRef.current = false;
          if (step.navigateTo) navigate(step.navigateTo);
          advance();
        }, step.postDelay ?? 60);
      } else if (!step.allowFreeClicks && !isAllowed) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
      }
    };
    document.addEventListener("click", handler, true);
    document.addEventListener("touchend", handler, true);
    return () => {
      document.removeEventListener("click", handler, true);
      document.removeEventListener("touchend", handler, true);
    };
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
  // or after a short fallback on mobile/unsupported browsers where the
  // fullscreen API may silently fail or fall back to CSS fullscreen.
  useEffect(() => {
    if (!active || !step) return;
    if (step.id !== "watch-fullscreen") return;
    let advanced = false;
    const doAdvance = (exitFs: boolean) => {
      if (advanced) return;
      advanced = true;
      setTimeout(() => {
        if (exitFs) {
          try {
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
            else if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
              (document as any).webkitExitFullscreen();
            }
          } catch { /* noop */ }
        }
        if (step.navigateTo) navigate(step.navigateTo);
        advance();
      }, exitFs ? 1400 : 200);
    };
    const fsHandler = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (!fsEl) return;
      doAdvance(true);
    };
    // Listen for a tap on the fullscreen button itself — covers mobile browsers
    // where requestFullscreen rejects silently and no fullscreenchange fires.
    const clickHandler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-tour="fullscreen-btn"]')) {
        // Wait a moment to see if real fullscreen kicks in; otherwise advance.
        setTimeout(() => {
          const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
          if (fsEl) return; // fsHandler will take it from here
          doAdvance(false);
        }, 900);
      }
    };
    document.addEventListener("fullscreenchange", fsHandler);
    document.addEventListener("webkitfullscreenchange", fsHandler);
    document.addEventListener("click", clickHandler, true);
    document.addEventListener("touchend", clickHandler, true);
    return () => {
      document.removeEventListener("fullscreenchange", fsHandler);
      document.removeEventListener("webkitfullscreenchange", fsHandler);
      document.removeEventListener("click", clickHandler, true);
      document.removeEventListener("touchend", clickHandler, true);
    };
  }, [active, step, advance, navigate]);


  if (!active || !step) return null;

  const isMobileViewport = typeof window !== "undefined" && window.innerWidth < 768;
  // Tighter pad on mobile so the ring hugs small buttons like "Dual: ON".
  const pad = step.pad ?? (isMobileViewport ? 4 : 8);
  const ring = rect
    ? (() => {
        const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
        const vh = typeof window !== "undefined" ? window.innerHeight : 768;
        const left = Math.max(2, rect.left - pad);
        const top = Math.max(2, rect.top - pad);
        const right = Math.min(vw - 2, rect.left + rect.width + pad);
        const bottom = Math.min(vh - 2, rect.top + rect.height + pad);
        return { left, top, width: right - left, height: bottom - top };
      })()
    : null;

  // Cursor target = center of cursorRect (which may differ from spotlight).
  const cursorPos = cursorRect
    ? { left: cursorRect.left + cursorRect.width * 0.5, top: cursorRect.top + cursorRect.height * 0.5 }
    : ring
      ? { left: ring.left + ring.width * 0.5, top: ring.top + ring.height * 0.5 }
      : { left: window.innerWidth / 2, top: window.innerHeight / 2 };

  // Tooltip placement. pointerEvents:none so it never blocks taps on mobile.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const isNarrow = vw < 640;
  const ttMax = Math.min(280, vw - 24);
  let tooltipStyle: React.CSSProperties = {
    zIndex: Z_TOOLTIP,
    position: "fixed",
    maxWidth: ttMax,
    width: isNarrow ? "calc(100vw - 24px)" : undefined,
    pointerEvents: "none",
  };
  if (ring) {
    let placement = step.placement || "bottom";
    // On narrow screens, force top/bottom and clamp horizontally to viewport.
    if (isNarrow && (placement === "left" || placement === "right")) {
      placement = ring.top > vh / 2 ? "top" : "bottom";
    }
    if (placement === "bottom") {
      const top = Math.min(ring.top + ring.height + 16, vh - 80);
      tooltipStyle = { ...tooltipStyle, left: "50%", top, transform: "translateX(-50%)" };
    } else if (placement === "top") {
      const top = Math.max(ring.top - 16, 80);
      tooltipStyle = { ...tooltipStyle, left: "50%", top, transform: "translate(-50%, -100%)" };
    } else if (placement === "right") {
      tooltipStyle = { ...tooltipStyle, left: ring.left + ring.width + 16, top: ring.top + ring.height / 2, transform: "translateY(-50%)" };
    } else {
      tooltipStyle = { ...tooltipStyle, left: ring.left - 16, top: ring.top + ring.height / 2, transform: "translate(-100%, -50%)" };
    }
    if (isNarrow) {
      tooltipStyle.left = "50%";
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
          transition={isMobileViewport ? { type: "tween", duration: 0.12 } : { type: "spring", stiffness: 220, damping: 28 }}
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
          transition={isMobileViewport ? { type: "tween", duration: 0.12 } : { type: "spring", stiffness: 220, damping: 28 }}
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

      {/* Always-available escape hatch so a stuck tour can never trap the user. */}
      <button
        type="button"
        onClick={end}
        style={{ position: "fixed", top: 12, right: 12, zIndex: Z_TOOLTIP + 1 }}
        className="rounded-full bg-white/90 hover:bg-white text-neutral-700 text-xs font-medium px-3 py-1.5 shadow-lg border border-orange-100"
      >
        Skip tour
      </button>

    </>
  );
};


