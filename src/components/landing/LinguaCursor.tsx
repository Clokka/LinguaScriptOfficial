import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

/**
 * The LinguaScript cursor — the green arrow from the brand set, following the
 * pointer with a touch of lag, plus a soft halo that trails further behind.
 *
 * Mounts only for fine pointers with hover, and bails entirely under
 * prefers-reduced-motion, so touch users and motion-sensitive users keep their
 * native cursor. The native cursor is hidden via a class on <html> that is
 * removed on unmount — so leaving the landing page always restores it.
 */
export const LinguaCursor = () => {
  const arrow = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const a = arrow.current;
    const h = halo.current;
    if (!a || !h) return;

    document.documentElement.classList.add("ls-cursor-none");
    gsap.set([a, h], { autoAlpha: 0 });

    const ax = gsap.quickTo(a, "x", { duration: 0.08, ease: "power2.out" });
    const ay = gsap.quickTo(a, "y", { duration: 0.08, ease: "power2.out" });
    const hx = gsap.quickTo(h, "x", { duration: 0.42, ease: "power3.out" });
    const hy = gsap.quickTo(h, "y", { duration: 0.42, ease: "power3.out" });

    let shown = false;
    const onMove = (e: PointerEvent) => {
      if (!shown) {
        shown = true;
        gsap.to([a, h], { autoAlpha: 1, duration: 0.25 });
      }
      ax(e.clientX);
      ay(e.clientY);
      hx(e.clientX);
      hy(e.clientY);

      // Grow the halo over anything clickable.
      const hot = (e.target as Element | null)?.closest(
        "a,button,[role='button'],input,select,textarea,[data-cursor='hot']",
      );
      gsap.to(h, { scale: hot ? 2.1 : 1, duration: 0.28, ease: "power3.out" });
    };

    const onDown = () => gsap.to(a, { scale: 0.82, duration: 0.12 });
    const onUp = () => gsap.to(a, { scale: 1, duration: 0.18 });
    const onOut = () => gsap.to([a, h], { autoAlpha: 0, duration: 0.2 });

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerleave", onOut);

    return () => {
      document.documentElement.classList.remove("ls-cursor-none");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onOut);
      gsap.killTweensOf([a, h]);
    };
  }, []);

  return (
    <>
      <style>{`.ls-cursor-none, .ls-cursor-none * { cursor: none !important; }`}</style>

      {/* Trailing halo */}
      <div
        ref={halo}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9998] -ml-4 -mt-4 h-8 w-8 rounded-full"
        style={{
          border: "1.5px solid #34C75955",
          background: "#34C7590F",
          willChange: "transform",
        }}
      />

      {/* Arrow */}
      <div
        ref={arrow}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9999]"
        style={{ willChange: "transform" }}
      >
        <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
          <path
            d="M2.6 1.4 L2.6 24.2 L8.4 18.7 L12.2 27.6 L17.1 25.5 L13.3 16.8 L21.4 16.4 Z"
            fill="#5AAE22"
            stroke="#2E7A0F"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="5.4" y="5.2" width="2.6" height="8.4" rx="1.3" fill="#F5F7F5" />
          <circle cx="6.7" cy="16.4" r="1.5" fill="#F5F7F5" />
        </svg>
      </div>
    </>
  );
};

export default LinguaCursor;
