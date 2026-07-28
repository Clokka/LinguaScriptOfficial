// LandingPage3 — premium "turn the language green" landing page.
// Dark 3D-forward aesthetic with magnetic buttons, scroll-reveal storytelling,
// neumorphic depth and the red→orange→green deck system as the hero motif.
// Reuses the app's real building blocks: PetLive (3D GLB pet) and
// LandingChameleonDemo (interactive save→review→green demo). Route: /landingpage3
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useScroll, useTransform } from "framer-motion";
import { PetLive } from "@/components/pets/PetLive";
import { ChameleonMascot, ChameleonTier } from "@/components/ChameleonMascot";
import { ChameleonWordDemo } from "@/components/ChameleonWordDemo";

// Exact deck palette — identical to Flashcards DECK_CONFIG and the extension.
const DECK = {
  red: "#FF3B30",
  orange: "#FF8A00",
  green: "#34C759",
};
const BRAND = "#7bbf27"; // --brand-green

// ── Magnetic button ──────────────────────────────────────────────────────────
// The cursor "pulls" the button toward it with spring physics — the tactile,
// expensive-feeling micro-interaction premium sites use.
function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "dark";
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 14, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 14, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set((e.clientX - (r.left + r.width / 2)) * 0.4);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.4);
  };
  const reset = () => { x.set(0); y.set(0); };

  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[15px] font-bold tracking-tight cursor-pointer select-none transition-colors";
  const styles: Record<string, string> = {
    primary: "text-[#04120a]",
    dark: "text-white bg-white/[0.06] border border-white/10 hover:bg-white/[0.1]",
    ghost: "text-white/80 hover:text-white",
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{
        x: sx,
        y: sy,
        ...(variant === "primary"
          ? { background: BRAND, boxShadow: `0 10px 40px ${BRAND}55, inset 0 1px 0 rgba(255,255,255,0.4)` }
          : {}),
      }}
      whileTap={{ scale: 0.96 }}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </motion.a>
  );
}

// Small store-badge glyphs (kept inline so the page has zero missing assets).
const AppleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.98-.75.84-1.98 1.49-3.02 1.41-.13-1.1.42-2.27 1.09-3 .74-.81 2.05-1.42 3.05-1.39zM20.5 17.2c-.57 1.32-.84 1.9-1.58 3.07-1.03 1.63-2.48 3.67-4.28 3.68-1.6.02-2.01-1.04-4.18-1.03-2.17.01-2.62 1.05-4.22 1.03-1.8-.02-3.17-1.85-4.2-3.48C-.66 16.9-.29 11.4 2.4 8.6c1-1.07 2.35-1.75 3.82-1.75 1.66 0 2.7 1.07 4.07 1.07 1.33 0 2.14-1.07 4.06-1.07 1.3 0 2.68.71 3.66 1.94-3.22 1.76-2.7 6.36.49 8.41z"/></svg>
);
const PlayGlyph = () => (
  <svg width="16" height="18" viewBox="0 0 24 24" aria-hidden><path d="M3 2.5v19l11-9.5z" fill="#34C759"/><path d="M3 2.5l11 9.5-3 2.6z" fill="#FF3B30"/><path d="M3 21.5l11-9.5-3-2.6z" fill="#FF8A00"/><path d="M14 12l4.5-3.9c1.2-.7 1.2 1 0 1.7L14 12l4.5 3.9c1.2.7 1.2-1 0-1.7z" fill="#7bbf27"/></svg>
);

// ── Scroll reveal wrapper ────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage3() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const petY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [0.9, 0.2]);

  // Hero chameleon slowly cycles red → orange → green to sell the promise.
  const [heroTier, setHeroTier] = useState<ChameleonTier>("red");
  useEffect(() => {
    const seq: ChameleonTier[] = ["red", "orange", "green"];
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % seq.length; setHeroTier(seq[i]); }, 1700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#050a07] text-white antialiased [font-family:Inter,system-ui,sans-serif]">
      {/* ambient rainforest glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-[120px]" style={{ background: `${BRAND}22` }} />
        <div className="absolute bottom-0 right-[-10%] h-[420px] w-[420px] rounded-full blur-[130px]" style={{ background: `${DECK.green}18` }} />
      </div>

      {/* nav */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <img src="/mascot/chameleon.png" alt="" className="h-8 w-8 object-contain" />
          Lingua<span style={{ color: BRAND }}>Script</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#pets" className="hover:text-white">Your pets</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
        </nav>
        <MagneticButton href="/auth" variant="dark" className="!px-5 !py-2.5 !text-sm">Log in</MagneticButton>
      </header>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-6 pb-24 pt-10 md:grid-cols-2 md:pt-16">
        <div>
          <Reveal>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/70">
              <span className="h-2 w-2 rounded-full" style={{ background: BRAND, boxShadow: `0 0 10px ${BRAND}` }} />
              Learn by watching what you love
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-[clamp(2.6rem,6vw,4.6rem)] font-black leading-[0.98] tracking-[-0.03em]">
              Watch the language
              <br />
              <span style={{ color: BRAND }}>turn green.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-white/60">
              Every word you meet on Netflix &amp; YouTube joins your deck — <span style={{ color: DECK.red }}>red</span> when it's new,{" "}
              <span style={{ color: DECK.orange }}>orange</span> as it strengthens, <span style={{ color: DECK.green }}>green</span> once it's yours.
              Turn the whole screen green.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <MagneticButton href="#" variant="dark"><AppleGlyph /> App Store</MagneticButton>
              <MagneticButton href="#" variant="dark"><PlayGlyph /> Google Play</MagneticButton>
              <MagneticButton href="/discover" variant="primary">Start free →</MagneticButton>
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-8 flex items-center gap-6 text-xs text-white/40">
              <span>★★★★★ loved by learners</span>
              <span>Free for students</span>
            </div>
          </Reveal>
        </div>

        {/* 3D pet hero */}
        <div className="relative flex items-center justify-center">
          <motion.div style={{ opacity: glowOpacity }} className="absolute h-[340px] w-[340px] rounded-full blur-[90px]" aria-hidden>
            <div className="h-full w-full rounded-full" style={{ background: `radial-gradient(circle, ${BRAND}55, transparent 70%)` }} />
          </motion.div>
          <motion.div style={{ y: petY }} className="relative w-[min(460px,86vw)]">
            <ChameleonMascot tier={heroTier} />
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <Reveal><h2 className="text-center text-[clamp(1.8rem,4vw,2.8rem)] font-black tracking-tight">Three steps to fluency</h2></Reveal>
        <Reveal delay={0.08}><p className="mx-auto mt-3 max-w-lg text-center text-white/50">No flashcard grind. Just watch, tap, and let your pet grow with you.</p></Reveal>
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            { emoji: "🎬", title: "Pick your show", body: "Open anything on Netflix or YouTube with our extension. Dual subtitles, instantly." },
            { emoji: "👆", title: "Tap words you meet", body: "Every tap saves a word to your deck. It starts red and climbs to green as you review." },
            { emoji: "🦎", title: "Level up your pet", body: "Your comprehension turns the screen — and your chameleon — green. Progress you can see." },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1}>
              <div className="group h-full rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-7 transition-all hover:-translate-y-1 hover:border-white/15" style={{ boxShadow: "0 20px 50px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-2xl">{c.emoji}</div>
                <h3 className="text-lg font-bold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── DECK PROGRESSION ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <Reveal><h2 className="text-center text-[clamp(1.8rem,4vw,2.8rem)] font-black tracking-tight">Every word has a colour</h2></Reveal>
        <Reveal delay={0.08}><p className="mx-auto mt-3 max-w-lg text-center text-white/50">The same system across the app, the website and the browser extension.</p></Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { c: DECK.red, label: "UNKNOWN", n: "22", sub: "Newly saved words" },
            { c: DECK.orange, label: "LEARNING", n: "578", sub: "Strengthening words" },
            { c: DECK.green, label: "KNOWN", n: "2951", sub: "Acquired words" },
          ].map((d, i) => (
            <Reveal key={d.label} delay={i * 0.1}>
              <div className="rounded-3xl p-6 text-[#0a0a0a]" style={{ background: d.c, boxShadow: `0 24px 60px -24px ${d.c}` }}>
                <div className="mb-8 h-6 w-6 rounded-full border-2 border-black/20 bg-black/10" />
                <div className="text-xs font-bold tracking-widest text-black/70">{d.label}</div>
                <div className="text-5xl font-black leading-none">{d.n}</div>
                <div className="mt-1 text-sm font-semibold text-black/70">{d.sub}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── INTERACTIVE DEMO (reuses the real chameleon demo) ── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20">
        <Reveal><h2 className="mb-10 text-center text-[clamp(1.8rem,4vw,2.8rem)] font-black tracking-tight">Try it — turn this sentence green</h2></Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-10">
            <ChameleonWordDemo />
          </div>
        </Reveal>
      </section>

      {/* ── PET UNIVERSE ── */}
      <section id="pets" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <Reveal><h2 className="text-center text-[clamp(1.8rem,4vw,2.8rem)] font-black tracking-tight">Grow a whole menagerie</h2></Reveal>
        <Reveal delay={0.08}><p className="mx-auto mt-3 max-w-lg text-center text-white/50">Unlock living 3D companions as your streak and vocabulary grow.</p></Reveal>
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { f: "/pets/Gecko_Animations.glb", name: "Gecko" },
            { f: "/pets/Sparrow_Animations.glb", name: "Sparrow" },
            { f: "/pets/Colobus_Animations.glb", name: "Colobus" },
            { f: "/pets/Pudu_Animations.glb", name: "Pudú" },
          ].map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <div className="flex flex-col items-center rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:-translate-y-1 hover:border-white/15">
                <PetLive glbFile={p.f} size={150} />
                <span className="mt-2 text-sm font-semibold text-white/70">{p.name}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-4xl px-6 py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 p-10 text-center sm:p-16" style={{ background: `linear-gradient(160deg, ${BRAND}18, transparent 60%), rgba(255,255,255,0.02)` }}>
            <h2 className="text-[clamp(2rem,5vw,3.4rem)] font-black leading-tight tracking-tight">Ready to learn differently?</h2>
            <p className="mx-auto mt-4 max-w-md text-white/55">Free for students. Turn everything you watch into fluency.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <MagneticButton href="/discover" variant="primary">Start free →</MagneticButton>
              <MagneticButton href="#" variant="dark"><AppleGlyph /> App Store</MagneticButton>
              <MagneticButton href="#" variant="dark"><PlayGlyph /> Google Play</MagneticButton>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] py-10 text-center text-sm text-white/30">
        <img src="/mascot/chameleon.png" alt="" className="mx-auto mb-3 h-8 w-8 object-contain opacity-70" />
        © {new Date().getFullYear()} LinguaScript — turn the language green.
      </footer>
    </div>
  );
}
