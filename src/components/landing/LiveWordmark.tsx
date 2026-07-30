import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";
import { DECK } from "@/lib/deck-colors";

gsap.registerPlugin(ScrollTrigger);

/**
 * The LinguaScript wordmark, alive.
 *
 * The conceit: your cursor teaches the letters. Proximity is knowledge, so the
 * "Script" letters ramp red → orange → green as the pointer nears them and
 * decay back toward red as it leaves. The brand's core mechanic, played on the
 * brand's own name.
 *
 * Layers:
 *  1. Teach sweep      — on scroll-in, Script runs red → orange → green in
 *                        sequence and settles at green.
 *  2. Idle breathing   — staggered sine so the mark is never static.
 *  3. Pointer field    — per-letter lift, scale and lean, plus the colour ramp.
 *  4. Parallax tilt    — the whole lockup rotates in perspective toward the
 *                        cursor, giving the flat type real depth.
 *  5. Sheen            — a slow specular sweep across the green letters.
 *  6. Click burst      — letters scatter and spring home.
 *
 * Performance: letter rects are measured once and re-measured only on resize /
 * scroll, never per pointermove; all per-letter writes go through gsap.quickTo
 * (one reused tween each) rather than allocating a tween per event.
 *
 * Degradation: reduced-motion gets a static green lockup; coarse pointers get
 * the sweep and breathing but no pointer field, tilt or burst.
 */
const LINGUA = "Lingua".split("");
const SCRIPT = "Script".split("");
const RADIUS = 260;

export const LiveWordmark = ({ className }: { className?: string }) => {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLSpanElement>(null);
  const letters = useRef<(HTMLSpanElement | null)[]>([]);

  useLayoutEffect(() => {
    const el = root.current;
    const st = stage.current;
    if (!el || !st) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = letters.current.filter(Boolean) as HTMLSpanElement[];
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const ramp = gsap.utils.interpolate([DECK.red, DECK.orange, DECK.green]);
    const isDeck = (n: HTMLSpanElement) => n.dataset.deck === "1";

    const ctx = gsap.context(() => {
      // 1 — teach sweep, one driver per letter so they don't share state.
      nodes.filter(isDeck).forEach((n, i) => {
        const drive = { v: 0 };
        n.style.color = DECK.red;
        gsap.to(drive, {
          v: 1,
          duration: 1,
          delay: i * 0.1,
          ease: "power2.inOut",
          scrollTrigger: { trigger: el, start: "top 80%", once: true },
          onUpdate: () => (n.style.color = ramp(drive.v)),
          onComplete: () => (n.style.color = DECK.green),
        });
      });

      // 2 — idle breathing (separate transform channel so it survives the
      // pointer field writing to y).
      gsap.to(nodes, {
        yPercent: -5,
        duration: 2,
        ease: "sine.inOut",
        stagger: { each: 0.06, yoyo: true, repeat: -1 },
        yoyo: true,
        repeat: -1,
      });

      // 5 — specular sheen across the green letters.
      gsap.fromTo(
        st,
        { "--sheen": "-40%" } as gsap.TweenVars,
        {
          "--sheen": "140%",
          duration: 3.4,
          ease: "power2.inOut",
          repeat: -1,
          repeatDelay: 2.4,
        } as gsap.TweenVars,
      );

      if (!fine) return;

      // Cache geometry — measuring 12 rects per pointermove is the classic
      // layout-thrash trap.
      let rects: DOMRect[] = [];
      const measure = () => (rects = nodes.map((n) => n.getBoundingClientRect()));
      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, { passive: true });

      const yTo = nodes.map((n) => gsap.quickTo(n, "y", { duration: 0.5, ease: "power3.out" }));
      const sTo = nodes.map((n) => gsap.quickTo(n, "scale", { duration: 0.5, ease: "power3.out" }));
      const rTo = nodes.map((n) => gsap.quickTo(n, "rotate", { duration: 0.5, ease: "power3.out" }));
      const rxTo = gsap.quickTo(st, "rotationX", { duration: 0.7, ease: "power3.out" });
      const ryTo = gsap.quickTo(st, "rotationY", { duration: 0.7, ease: "power3.out" });

      const onMove = (e: PointerEvent) => {
        // 4 — parallax tilt from cursor position over the block.
        const b = el.getBoundingClientRect();
        const nx = (e.clientX - (b.left + b.width / 2)) / (b.width / 2);
        const ny = (e.clientY - (b.top + b.height / 2)) / (b.height / 2);
        ryTo(gsap.utils.clamp(-1, 1, nx) * 11);
        rxTo(gsap.utils.clamp(-1, 1, ny) * -8);

        // 3 — per-letter field.
        nodes.forEach((n, i) => {
          const r = rects[i];
          if (!r) return;
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          const pull = gsap.utils.clamp(0, 1, 1 - Math.hypot(dx, dy) / RADIUS);

          yTo[i](-30 * pull);
          sTo[i](1 + 0.22 * pull);
          rTo[i](gsap.utils.clamp(-10, 10, dx / 26) * pull);

          if (isDeck(n)) {
            // Cursor as teacher: close = known = green.
            n.style.color = ramp(0.34 + pull * 0.66);
          } else {
            // Lingua stays white; it only picks up a green rim as you approach.
            n.style.textShadow = pull > 0.05 ? `0 0 ${18 * pull}px ${DECK.green}66` : "";
          }
        });
      };

      const onLeave = () => {
        rxTo(0);
        ryTo(0);
        nodes.forEach((n, i) => {
          yTo[i](0);
          sTo[i](1);
          rTo[i](0);
          if (isDeck(n)) n.style.color = DECK.green;
          else n.style.textShadow = "";
        });
      };

      // 6 — click burst.
      const onDown = () => {
        gsap.fromTo(
          nodes,
          { scale: 1 },
          {
            scale: 1.3,
            duration: 0.18,
            ease: "power2.out",
            stagger: { each: 0.02, from: "center" },
            yoyo: true,
            repeat: 1,
          },
        );
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("pointerdown", onDown);
      return () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
        el.removeEventListener("pointerdown", onDown);
      };
    }, el);

    return () => ctx.revert();
  }, []);

  let idx = 0;
  const render = (chars: string[], deck: boolean) =>
    chars.map((c) => {
      const i = idx++;
      return (
        <span
          key={`${c}-${i}`}
          ref={(n) => (letters.current[i] = n)}
          data-deck={deck ? "1" : "0"}
          className={cn("inline-block will-change-transform", deck && "ls-wm-deck")}
          style={{ color: deck ? DECK.green : "#ffffff" }}
        >
          {c}
        </span>
      );
    });

  return (
    <div
      ref={root}
      aria-label="LinguaScript"
      data-cursor="hot"
      className={cn("select-none", className)}
      style={{ perspective: "900px" }}
    >
      <style>{`
        .ls-wm-deck {
          background-image: linear-gradient(
            100deg,
            transparent calc(var(--sheen, -40%) - 14%),
            rgba(255,255,255,.85) var(--sheen, -40%),
            transparent calc(var(--sheen, -40%) + 14%)
          );
          -webkit-background-clip: text;
          background-clip: text;
        }
      `}</style>
      <span
        ref={stage}
        aria-hidden="true"
        className="inline-block font-extrabold tracking-tight leading-[1.05] whitespace-nowrap"
        style={{ fontSize: "clamp(2.25rem, 11.5vw, 10rem)", transformStyle: "preserve-3d" }}
      >
        {render(LINGUA, false)}
        {render(SCRIPT, true)}
      </span>
    </div>
  );
};

export default LiveWordmark;
