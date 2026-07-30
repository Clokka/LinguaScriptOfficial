import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { StoreBadges } from "@/components/landing/StoreBadges";
import { GreenMoment } from "@/components/landing/GreenMoment";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { LiveWordmark } from "@/components/landing/LiveWordmark";
import { LinguaCursor } from "@/components/landing/LinguaCursor";
import { Chameleon3D } from "@/components/landing/Chameleon3D";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { LineBlastDemo } from "@/components/LineBlastDemo";
import { PlatformLogos } from "@/components/landing/PlatformLogos";
import { DECK } from "@/lib/deck-colors";

/**
 * LinguaScript landing page v4.
 *
 * Direction: semantic dark. Near-black canvas, restrained type, and the deck
 * colours (red/orange/green) used ONLY where they carry meaning — never as
 * decoration. Glass appears in exactly two bands, both chosen because no deck
 * colour sits behind them: the store-badge bar and the stats band.
 *
 * Structure follows the 5 Cs: Clarity → Context → Creative → Credibility → CTA.
 * The single interactive showpiece is <GreenMoment />.
 *
 * Mounted at /landingpage4. /landingpage2 is untouched.
 */

const Wordmark = ({ className = "" }: { className?: string }) => (
  <span className={`font-extrabold tracking-tight ${className}`}>
    <span className="text-white">Lingua</span>
    <span style={{ color: DECK.green }}>Script</span>
  </span>
);

const reveal = {
  hidden: { opacity: 0, y: 22 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const Section = ({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) => (
  <section id={id} className={`relative max-w-5xl mx-auto px-6 ${className}`}>
    {children}
  </section>
);

const LandingPage4 = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#08080B] text-white antialiased overflow-x-hidden">
      <LinguaCursor />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08080B]/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Wordmark className="text-lg" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate("/auth")}
              className="px-3 py-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("/onboarding")}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-white text-[#08080B] hover:bg-white/90 transition-colors"
            >
              Open app
            </button>
          </div>
        </div>
      </nav>

      {/* ── 1. CLARITY — hero ── */}
      <Section className="pt-24 pb-20 text-center">
        <motion.p
          initial="hidden"
          animate="visible"
          variants={reveal}
          className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-7"
        >
          Subtitles that teach
        </motion.p>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={reveal}
          className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.03] mb-7"
        >
          Learn the language
          <br />
          you're already watching.
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={reveal}
          className="text-lg text-white/55 max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Every word you meet gets a colour. Watch it go from red to green — on
          Netflix, YouTube, and everywhere else you already spend your evenings.
        </motion.p>

        {/* Glass band #1 — no deck colour behind it, so blur costs us nothing. */}
        <motion.div initial="hidden" animate="visible" custom={3} variants={reveal}>
          <StoreBadges className="mb-5" />
          <p className="text-xs text-white/35">
            Free to start · No card required
          </p>
        </motion.div>
      </Section>

      {/* ── Platforms ── */}
      <Section className="pb-24">
        <PlatformLogos />
      </Section>

      {/* ── The wordmark, alive ── */}
      <section className="relative py-20 overflow-hidden border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <LiveWordmark className="mb-6" />
          <p className="text-sm text-white/35 max-w-md mx-auto">
            Move your cursor across it. The name does what the app does.
          </p>
        </div>
      </section>

      {/* ── 2. CONTEXT — the problem ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-5">
          Why shows don't teach you
        </p>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-14 max-w-3xl">
          You've watched 200 hours of French.
          <span className="text-white/40"> You still can't order coffee.</span>
        </h2>

        <div className="grid gap-px sm:grid-cols-3 bg-white/[0.06] rounded-2xl overflow-hidden">
          {[
            {
              t: "Subtitles do the work for you",
              d: "You read English, hear French, and absorb neither. The comprehension feels real and disappears by morning.",
            },
            {
              t: "You look a word up and lose it",
              d: "Pause, tab out, search, forget. By the next episode it's a stranger again — and you never notice it repeat.",
            },
            {
              t: "Nothing tracks what stuck",
              d: "No sense of progress, so no reason to continue. You can't tell a word you know from one you've merely seen.",
            },
          ].map((c, i) => (
            <motion.div
              key={c.t}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={i}
              variants={reveal}
              className="bg-[#08080B] p-7"
            >
              <h3 className="font-bold mb-2.5">{c.t}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{c.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── 3. CREATIVE — the showpiece ── */}
      <GreenMoment />

      {/* ── How it works ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-14">
          Three colours. That's the whole system.
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { c: DECK.red, tier: "red" as const, n: "Red", d: "A word you've never met. Tap it once and it's saved.", label: "Unknown" },
            { c: DECK.orange, tier: "orange" as const, n: "Orange", d: "You're learning it. It resurfaces until it sticks.", label: "Learning" },
            { c: DECK.green, tier: "green" as const, n: "Green", d: "You know it. It stops interrupting and starts counting.", label: "Known" },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={i}
              variants={reveal}
            >
              <div className="w-24 mb-5">
                <ChameleonMascot tier={s.tier} />
              </div>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2"
                style={{ color: s.c }}
              >
                {s.label}
              </p>
              <h3 className="text-xl font-bold mb-2">{s.n}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Line Blast — the key feature, playable ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-5">
          Line Blast
        </p>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-4">
          Turn the last white word
          <br />
          <span style={{ color: DECK.green }}>and the line detonates.</span>
        </h2>
        <p className="text-white/45 max-w-xl mb-12">
          Tap the words you know. When a subtitle goes fully green the whole line
          erupts and your combo climbs. Try it — this is the real thing, not a video.
        </p>

        <div data-cursor="hot">
          <LineBlastDemo />
        </div>

        <button
          onClick={() => navigate("/demo")}
          className="mt-8 text-sm font-semibold text-white/60 hover:text-white transition-colors"
        >
          Open the full Line Blast demo →
        </button>
      </Section>

      {/* ── The chameleon, in 3D ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-5">
              Your companion
            </p>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-5">
              It changes colour
              <br />
              because you did.
            </h2>
            <p className="text-white/45 max-w-md">
              The chameleon wears your progress. Red when a scene is full of
              strangers, green when you've earned it. Drag to spin it.
            </p>
          </div>
          <div className="flex justify-center" data-cursor="hot">
            <Chameleon3D tier="green" size={360} />
          </div>
        </div>
      </Section>

      {/* ── 4. CREDIBILITY ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          A number, not a test.
        </h2>
        <p className="text-white/45 max-w-xl mb-12">
          LinguaScript never quizzes you. It just tells you how much of the scene
          you actually understood.
        </p>

        {/* Glass band #2 — neutral surface, no deck colour behind the blur. */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-8 sm:p-10">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { v: "22", l: "Unknown", s: "Newly saved words", c: DECK.red },
              { v: "578", l: "Learning", s: "Strengthening words", c: DECK.orange },
              { v: "2,951", l: "Known", s: "Acquired words", c: DECK.green },
            ].map((k) => (
              <div key={k.l}>
                <span
                  className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-2"
                  style={{ color: k.c }}
                >
                  {k.l}
                </span>
                <span className="block text-4xl font-extrabold tabular-nums mb-1">{k.v}</span>
                <span className="block text-sm text-white/40">{k.s}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 pt-6 border-t border-white/10 text-xs text-white/35">
            One learner's vocabulary after a term of watching. Your numbers will
            look different.
          </p>
        </div>

        {/*
          TODO(rowan): real testimonials + store ratings.
          Deliberately left as visible placeholders rather than invented quotes —
          fabricated social proof is checkable and would undermine the page.
          Supply names, quotes, and permission and these become real cards.
        */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-dashed border-white/12 p-6 text-sm text-white/25"
            >
              Testimonial slot {i} — awaiting a real beta quote.
            </div>
          ))}
        </div>
      </Section>

      {/* ── 5. CALL TO ACTION ── */}
      <Section className="py-28 border-t border-white/[0.06] text-center">
        <div className="w-36 mx-auto mb-8">
          <ChameleonMascot tier="green" party />
        </div>
        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6">
          Start with tonight's episode.
        </h2>
        <p className="text-white/50 max-w-lg mx-auto mb-10">
          Install it, press play on something you were going to watch anyway, and
          save your first word. That's the whole onboarding.
        </p>

        <MagneticButton
          onClick={() => navigate("/onboarding")}
          className="px-8 py-4 rounded-xl font-bold text-[#08080B] text-lg"
          style={{ backgroundColor: DECK.green }}
        >
          I want to start watching
        </MagneticButton>

        <div className="mt-10">
          <StoreBadges />
        </div>
      </Section>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <Wordmark className="text-sm" />
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} LinguaScript
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage4;
