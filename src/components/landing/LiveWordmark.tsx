import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";
import { DECK } from "@/lib/deck-colors";

gsap.registerPlugin(ScrollTrigger);

/**
 * The LinguaScript wordmark, alive.
 *
 * "Lingua" white, "Script" deck green — the brand lockup. Three behaviours:
 *
 *  1. On scroll-in, the Script letters run red → orange → green in sequence and
 *     hold at green. The name performs the product.
 *  2. Idle, every letter breathes on a staggered sine so the mark is never dead.
 *  3. Under the pointer, letters lift, scale and lean toward the cursor, and the
 *     green letters brighten — motion and luminance only, never a hue change, so
 *     the deck colour stays truthful.
 *
 * Per-letter transforms use gsap.quickTo (one reused tween each) rather than a
 * new tween per pointermove. Coarse pointers get the sweep and breathing but no
 * magnetism; reduced-motion users get a static green wordmark.
 */
const LINGUA = "Lingua".split("");
const SCRIPT = "Script".split("");

export const LiveWordmark = ({ className }: { className?: string }) => {
  const root = useRef<HTMLDivElement>(null);
  const letters = useRef<(HTMLSpanElement | null)[]>([]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = letters.current.filter(Boolean) as HTMLSpanElement[];
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const toGreen = gsap.utils.interpolate([DECK.red, DECK.orange, DECK.green]);

    const ctx = gsap.context(() => {
      // 1 — the teach sweep. Each letter gets its own driver object.
      nodes
        .filter((n) => n.dataset.deck === "1")
        .forEach((n, i) => {
          const drive = { v: 0 };
          n.style.color = DECK.red;
          gsap.to(drive, {
            v: 1,
            duration: 1,
            delay: i * 0.1,
            ease: "power2.inOut",
            scrollTrigger: { trigger: el, start: "top 78%", once: true },
            onUpdate: () => {
              n.style.color = toGreen(drive.v);
            },
            onComplete: () => {
              n.style.color = DECK.green;
            },
          });
        });

      // 2 — idle breathing.
      gsap.to(nodes, {
        y: -7,
        duration: 2,
        ease: "sine.inOut",
        stagger: { each: 0.06, yoyo: true, repeat: -1 },
        yoyo: true,
        repeat: -1,
      });

      if (!fine) return;

      // 3 — pointer magnetism.
      const yTo = nodes.map((n) => gsap.quickTo(n, "y", { duration: 0.5, ease: "power3.out" }));
      const sTo = nodes.map((n) => gsap.quickTo(n, "scale", { duration: 0.5, ease: "power3.out" }));
      const rTo = nodes.map((n) => gsap.quickTo(n, "rotate", { duration: 0.5, ease: "power3.out" }));

      const onMove = (e: PointerEvent) => {
        nodes.forEach((n, i) => {
          const r = n.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          const pull = gsap.utils.clamp(0, 1, 1 - Math.hypot(dx, dy) / 240);

          yTo[i](-28 * pull);
          sTo[i](1 + 0.2 * pull);
          rTo[i](gsap.utils.clamp(-9, 9, dx / 28) * pull);
          // Luminance only — the hue stays the deck colour it earned.
          n.style.filter = pull > 0.02 ? `brightness(${1 + pull * 0.5})` : "";
        });
      };

      const onLeave = () => {
        nodes.forEach((n, i) => {
          yTo[i](0);
          sTo[i](1);
          rTo[i](0);
          n.style.filter = "";
        });
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      return () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
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
          className="inline-block will-change-transform"
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
      className={cn(
        // clamp() keeps the lockup on one line from 320px up — a wordmark that
        // wraps mid-word is a broken wordmark.
        "select-none font-extrabold tracking-tight leading-[1.05] whitespace-nowrap",
        className,
      )}
      style={{ fontSize: "clamp(2.25rem, 11.5vw, 10rem)" }}
    >
      <span aria-hidden="true">
        {render(LINGUA, false)}
        {render(SCRIPT, true)}
      </span>
    </div>
  );
};

export default LiveWordmark;
