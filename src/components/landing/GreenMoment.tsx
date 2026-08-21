import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { DECK } from "@/lib/deck-colors";

gsap.registerPlugin(ScrollTrigger);

/** The line that turns green. French → English, word by word. */
const LINE = [
  { fr: "J'utiliserai", en: "I will use" },
  { fr: "la", en: "the" },
  { fr: "meilleure", en: "best" },
  { fr: "application", en: "app" },
  { fr: "d'apprentissage", en: "for learning" },
  { fr: "des", en: "" },
  { fr: "langues", en: "languages" },
  { fr: "(LinguaScript).", en: "(LinguaScript)." },
];

/**
 * The one showpiece on the page: as you scroll a single pinned section, the
 * subtitle turns word-by-word red → orange → green and the chameleon shifts
 * with it. This *is* the product — a word's colour is its deck, everywhere.
 *
 * Written with direct DOM writes inside a ScrollTrigger scrub rather than
 * React state, so scrolling never triggers a re-render.
 */
export const GreenMoment = () => {
  const root = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pctRef = useRef<HTMLSpanElement>(null);

  // The mascot's tier is discrete, so it only re-renders on the two boundary
  // crossings rather than on every scroll frame. `lastTier` guards the setState.
  const [tier, setTier] = useState<ChameleonTier>("red");
  const lastTier = useRef<ChameleonTier>("red");

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    const toColour = gsap.utils.interpolate([DECK.red, DECK.orange, DECK.green]);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Paint one frame of the effect at overall progress `p` (0 → 1).
    const paint = (p: number) => {
      const n = LINE.length;
      wordRefs.current.forEach((w, i) => {
        if (!w) return;
        // Each word runs its own red→green ramp, staggered across the scroll.
        const start = i / (n + 2);
        const local = gsap.utils.clamp(0, 1, (p - start) / (3 / (n + 2)));
        w.style.color = toColour(local);
        w.style.opacity = String(0.45 + local * 0.55);
      });
      if (pctRef.current) pctRef.current.textContent = `${Math.round(46 + p * 51)}%`;

      // Every word green → the chameleon commits to green. This is the payoff.
      const next: ChameleonTier = p > 0.82 ? "green" : p > 0.4 ? "orange" : "red";
      if (next !== lastTier.current) {
        lastTier.current = next;
        setTier(next);
      }
    };

    if (reduced) {
      paint(1);
      return;
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "+=180%",
        pin: true,
        scrub: 0.6,
        onUpdate: (self) => paint(self.progress),
        onRefresh: (self) => paint(self.progress),
      });
    }, el);

    paint(0);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative min-h-screen flex items-center overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#34C759] mb-5">
          The moment it clicks
        </p>
        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-14">
          Scroll to turn the
          <br />
          <span className="text-[#34C759]">LinguaScript green.</span>
        </h2>

        <div className="grid gap-12 md:grid-cols-[1.35fr_1fr] md:items-center">
          <div>
            <p className="flex flex-wrap gap-x-3 gap-y-2 text-3xl sm:text-4xl font-bold tracking-tight">
              {LINE.map((w, i) => (
                <span
                  key={w.fr}
                  ref={(n) => (wordRefs.current[i] = n)}
                  style={{ color: DECK.red }}
                  className="transition-none"
                >
                  {w.fr}
                </span>
              ))}
            </p>
            <p className="mt-4 text-lg text-white/45">
              {LINE.map((w) => w.en).join(" ")}
            </p>

            <div className="mt-10 flex items-baseline gap-3">
              <span ref={pctRef} className="text-5xl font-extrabold tabular-nums text-white">
                46%
              </span>
              <span className="text-sm text-white/50">of this scene understood</span>
            </div>
            <p className="mt-3 text-sm text-white/40 max-w-md">
              Red is a word you've never met. Orange you're learning. Green you know.
              Same three colours in the app, the extension, and on Netflix.
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <ChameleonMascot tier={tier} party={tier === "green"} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default GreenMoment;
