// "How LinguaScript works" explainer, told through the chameleon mascot:
// as the demo subtitle turns green, a green aura behind the mascot grows and
// the comprehension meter fills — dramatising the core USP (the language
// turns green). Uses the Gecko GLB as a stand-in chameleon; swap glbFile for
// the real mascot model when it lands.
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { PetLive, PetLiveHandle } from "@/components/pets/PetLive";
import { cn } from "@/lib/utils";

const MASCOT_GLB = "/pets/Gecko_Animations.glb";

// "Je voudrais un café noir" — function words start green (low weight),
// two content words are the reveal.
const TOKENS = [
  { t: "Je", fn: true, green: true },
  { t: "voudrais", green: false },
  { t: "un", fn: true, green: true },
  { t: "café", green: true },
  { t: "noir", green: false },
];
const REVEAL = [1, 4]; // indices of the two learnable words

const STEPS = [
  { n: 1, title: "Watch anything", body: "Films, YouTube, Netflix — LinguaScript overlays living dual subtitles." },
  { n: 2, title: "A word clicks", body: "Tap to save it, or just recognise it. The word turns green in place." },
  { n: 3, title: "Everything gets greener", body: "Your mascot — and your whole transcript — shifts green as you understand more." },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const LandingChameleonDemo = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<PetLiveHandle>(null);
  const inView = useInView(rootRef, { once: true, margin: "120px" });
  const [ready, setReady] = useState(false);
  const [greens, setGreens] = useState<boolean[]>(() => TOKENS.map((t) => !!t.green));

  const weight = (i: number) => (TOKENS[i].fn ? 0.25 : 1);
  const pct = (() => {
    let known = 0;
    let total = 0;
    TOKENS.forEach((_, i) => {
      total += weight(i);
      if (greens[i]) known += weight(i);
    });
    return Math.round((known / total) * 100);
  })();

  // Loop the reveal so the USP is always visibly happening.
  useEffect(() => {
    if (!inView) return;
    const reduced = prefersReducedMotion();
    if (reduced) {
      setGreens(TOKENS.map(() => true));
      return;
    }
    let step = 0;
    let timer: number;
    const run = () => {
      if (step < REVEAL.length) {
        const idx = REVEAL[step];
        setGreens((prev) => {
          const next = [...prev];
          next[idx] = true;
          return next;
        });
        step += 1;
        // celebratory hop when the last word lands (line complete)
        if (step === REVEAL.length) liveRef.current?.play("Bounce");
        timer = window.setTimeout(run, 1500);
      } else {
        // hold on full green, then reset and replay
        timer = window.setTimeout(() => {
          setGreens(TOKENS.map((t) => !!t.green));
          step = 0;
          timer = window.setTimeout(run, 1000);
        }, 2400);
      }
    };
    timer = window.setTimeout(run, 1400);
    return () => clearTimeout(timer);
  }, [inView]);

  // Aura strength tracks comprehension.
  const auraOpacity = 0.15 + (pct / 100) * 0.55;
  const auraScale = 0.85 + (pct / 100) * 0.4;

  return (
    <div ref={rootRef} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      {/* Mascot stage */}
      <div className="relative mx-auto flex h-[320px] w-full max-w-[420px] items-center justify-center">
        {/* Green aura, scaled by comprehension */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-emerald-400 blur-[70px] transition-all duration-700"
          style={{
            width: 260,
            height: 260,
            opacity: auraOpacity,
            transform: `scale(${auraScale})`,
          }}
        />
        {!ready && (
          <span className="absolute text-7xl opacity-40" aria-hidden>
            🦎
          </span>
        )}
        {inView && (
          <div className={cn("relative transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}>
            <PetLive ref={liveRef} glbFile={MASCOT_GLB} size={300} onReady={() => setReady(true)} />
          </div>
        )}

        {/* Demo subtitle + meter, floating under the mascot */}
        <div className="absolute -bottom-2 left-1/2 w-[320px] max-w-[90%] -translate-x-1/2">
          <div className="rounded-xl border border-white/10 bg-[rgba(8,12,11,0.72)] px-4 py-3 text-center backdrop-blur-md">
            <p className="text-base font-medium leading-relaxed sm:text-lg">
              {TOKENS.map((tok, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-block whitespace-pre transition-colors duration-500",
                    greens[i]
                      ? cn("text-emerald-400/80", !tok.fn && "font-medium")
                      : "font-semibold text-white",
                  )}
                >
                  {tok.t}
                  {i < TOKENS.length - 1 ? " " : ""}
                </span>
              ))}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold tabular-nums text-emerald-300">{pct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-5">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="flex gap-4"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-base font-black text-emerald-300">
              {step.n}
            </div>
            <div>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
