import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Seo } from "@/components/Seo";
import { StoreBadges } from "@/components/landing/StoreBadges";
import { GreenMoment } from "@/components/landing/GreenMoment";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { LinguaCursor } from "@/components/landing/LinguaCursor";
import { Chameleon3D } from "@/components/landing/Chameleon3D";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { HeroWordmarkBlast } from "@/components/landing/HeroWordmarkBlast";
import { LinguaScriptsDemo } from "@/components/landing/LinguaScriptsDemo";
import { LineBlastDemo } from "@/components/LineBlastDemo";
import { PlatformLogos } from "@/components/landing/PlatformLogos";
import { DeckCards } from "@/components/landing/DeckCards";
import { DECK } from "@/lib/deck-colors";
import brandLockup from "@/assets/brand/linguascript-wordmark.png.asset.json";
import quizletLogo from "@/assets/brand/quizlet.png.asset.json";
import ankiLogo from "@/assets/brand/anki.png.asset.json";

/**
 * The Chameleon Method — LinguaScript's landing page.
 *
 * Every section on this page is the product, running live. No screenshots, no
 * looping screen recordings: the hero blast, the Line Blast and the
 * LinguaScripts exercise all import the same code the app ships, so nothing
 * here can promise something the app does not do.
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

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-5">
    {children}
  </p>
);

const Landing5 = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#08080B] text-white antialiased overflow-x-hidden">
      <Seo
        title="LinguaScript — The Chameleon Method for learning languages"
        description="Learn a language by watching what you already love. Dual subtitles, click-to-translate and spaced repetition that turns every word you know green."
        path="/"
        rawTitle
      />
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
              Sign up free
            </button>
          </div>
        </div>
      </nav>

      {/* ── 1. The wordmark is the product ── */}
      <Section className="pt-16 pb-14 text-center">
        <motion.p
          initial="hidden"
          animate="visible"
          variants={reveal}
          className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-8"
        >
          The Chameleon Method
        </motion.p>

        <HeroWordmarkBlast />

        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={reveal}
          className="mt-2 text-lg sm:text-xl text-white/60 max-w-xl mx-auto leading-relaxed"
        >
          The app that makes learning a language free, fun, and open to everyone.
        </motion.p>

        <motion.div initial="hidden" animate="visible" custom={3} variants={reveal}>
          <StoreBadges className="mt-9 mb-5" />
          <p className="text-xs text-white/35">Free to start. No card, no trial countdown.</p>
        </motion.div>
      </Section>

      {/* ── 2. Line Blast — the first real thing you touch ── */}
      <Section className="py-20 border-t border-white/[0.06]">
        <Eyebrow>Line Blast</Eyebrow>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-4">
          Finish the line.
          <br />
          <span style={{ color: DECK.green }}>Watch it go green.</span>
        </h2>
        <p className="text-white/45 max-w-xl mb-12">
          Tap the words you already know. When the last one turns, the whole line is
          yours. This is the real thing below, not a video of it.
        </p>

        <div data-cursor="hot">
          <LineBlastDemo />
        </div>
      </Section>

      {/* ── 3. Your companion ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <Eyebrow>Your companion</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-5">
              It changes colour
              <br />
              because you did.
            </h2>
            <p className="text-white/45 max-w-md">
              The chameleon wears your progress. Red when a scene is full of strangers,
              green once you have earned it. It watches your cursor while it waits.
            </p>
          </div>
          <div className="flex justify-center" data-cursor="hot">
            <Chameleon3D tier="green" size={360} />
          </div>
        </div>
      </Section>

      {/* ── 4. Scroll to turn the LinguaScript green ── */}
      <GreenMoment />

      {/* ── 5. LinguaScripts, live ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <Eyebrow>LinguaScripts</Eyebrow>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-4">
          Your words come back
          <br />
          as sentences.
        </h2>
        <p className="text-white/45 max-w-xl mb-12">
          Every word you save is rebuilt into a short exercise written around it, then
          served back on the day you are about to forget it. Play one now. This is the
          same exercise the app runs, minus your deck.
        </p>

        <LinguaScriptsDemo />
      </Section>

      {/* ── 6. Three colours ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-14">
          Three colours. That is the whole system.
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { c: DECK.red, tier: "red" as const, n: "Red", d: "A word you have never met. Tap it once and it is saved.", label: "Unknown" },
            { c: DECK.orange, tier: "orange" as const, n: "Orange", d: "You are learning it. It resurfaces until it sticks.", label: "Learning" },
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
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: s.c }}>
                {s.label}
              </p>
              <h3 className="text-xl font-bold mb-2">{s.n}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── 7. Where it runs ── */}
      <Section className="py-20 border-t border-white/[0.06]">
        <PlatformLogos />
      </Section>

      {/* ── 8. A number, not a test ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          A number, not a test.
        </h2>
        <p className="text-white/45 max-w-xl mb-12">
          LinguaScript never quizzes you cold. It tells you how much of the scene you
          actually understood, and that number goes up on its own.
        </p>
        <DeckCards />
        <p className="mt-6 text-xs text-white/35">
          One learner's vocabulary after a term of watching. Yours will look different.
        </p>
      </Section>

      {/* ── 9. Students and schools ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <Eyebrow>Students and schools</Eyebrow>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-5">
          Pro is free
          <br />
          if you are in school.
        </h2>
        <p className="text-white/45 max-w-xl mb-9">
          Request a student account with your school email and we hand you Pro at no
          cost. Teachers get a class dashboard with it. If you would rather not ask,
          the basic plan is genuinely free and always will be.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <MagneticButton
            onClick={() => navigate("/thechameleonmethod")}
            className="px-7 py-3.5 rounded-xl font-bold text-[#08080B]"
            style={{ backgroundColor: DECK.green }}
          >
            Request a student account
          </MagneticButton>
          <button
            onClick={() => navigate("/onboarding")}
            className="text-sm font-semibold text-white/55 hover:text-white transition-colors"
          >
            Continue with the basic plan →
          </button>
        </div>
      </Section>

      {/* ── 10. CTA ── */}
      <Section className="py-28 border-t border-white/[0.06] text-center">
        <div className="w-36 mx-auto mb-8">
          <ChameleonMascot tier="green" party />
        </div>
        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6">
          Start with tonight's episode.
        </h2>
        <p className="text-white/50 max-w-lg mx-auto mb-10">
          Press play on something you were going to watch anyway and save one word.
          That is the whole sign up.
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
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span>Your words export to</span>
            <img
              src={quizletLogo.url}
              alt="Quizlet"
              className="h-5 w-5 rounded opacity-60 hover:opacity-100 transition-opacity"
              loading="lazy"
            />
            <span className="text-white/40">Quizlet</span>
            <span className="text-white/15">·</span>
            <img
              src={ankiLogo.url}
              alt="Anki"
              className="h-5 w-5 rounded opacity-60 hover:opacity-100 transition-opacity"
              loading="lazy"
            />
            <span className="text-white/40">Anki</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <img
              src={brandLockup.url}
              alt="LinguaScript"
              className="h-6 w-auto opacity-80"
              loading="lazy"
            />
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
              <a href="/privacy" className="hover:text-white/80 transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-white/80 transition-colors">Terms of Service</a>
              <a href="mailto:rowan@linguascript.co.uk" className="hover:text-white/80 transition-colors">Contact</a>
              <span className="text-white/30">© {new Date().getFullYear()} LinguaScript</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing5;
