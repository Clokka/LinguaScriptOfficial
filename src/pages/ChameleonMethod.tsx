import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, GraduationCap, Eye, Layers, Repeat, Sparkles } from "lucide-react";
import { LiveWordmark } from "@/components/landing/LiveWordmark";
import { LinguaCursor } from "@/components/landing/LinguaCursor";
import { PlatformLogos } from "@/components/landing/PlatformLogos";
import { DeckCards } from "@/components/landing/DeckCards";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { StoreBadges } from "@/components/landing/StoreBadges";
import { FreeChameleonGift } from "@/components/landing/FreeChameleonGift";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { LandingChameleonDemo } from "@/components/LandingChameleonDemo";
import { DECK } from "@/lib/deck-colors";

/**
 * The Chameleon Method — LinguaScript's front door.
 *
 * Built on the same design language as /landingpage4: near-black canvas,
 * restrained type, and the deck colours (red/orange/green) used only where
 * they carry meaning. The previous version of this page used the legacy token
 * set (glass-panel-strong / text-foreground / text-success), which resolves
 * against the indigo primary and shared no colour with the rest of the brand.
 *
 * Section order is the argument: name the method, hand over a gift, show the
 * mechanic working, then ask for anything.
 */

const STEPS = [
  {
    icon: Eye,
    tier: "red" as const,
    title: "Watch what you already love",
    body:
      "Paste any YouTube video. LinguaScript adds dual subtitles in your target language and your own — no dubbed textbook dialogue.",
  },
  {
    icon: Layers,
    tier: "red" as const,
    title: "Tap the words you don't know",
    body:
      "Every tap saves a flashcard with the sentence it came from, so the meaning sticks to a real moment instead of a list.",
  },
  {
    icon: Repeat,
    tier: "orange" as const,
    title: "Turn the language green",
    body:
      "Words move red → orange → green as you review. Your subtitles visibly dim as your comprehension climbs.",
  },
  {
    icon: Sparkles,
    tier: "green" as const,
    title: "Rewatch and measure",
    body:
      "Watch the same video again and see your understanding jump, with a score you can actually track.",
  },
];

const PLANS = [
  { name: "Monthly", price: "£6.99", period: "/ month", note: "Cancel anytime" },
  { name: "Yearly", price: "£49", period: "/ year", note: "Two months free", highlight: true },
  { name: "Lifetime", price: "£99", period: "once", note: "Yours forever" },
];

const PRO_FEATURES = [
  "Unlimited learning languages",
  "Unlimited flashcards and reviews",
  "Priority AI translations",
  "Comprehension tracking on every video",
  "Every new feature, first",
];

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

export default function ChameleonMethod() {
  const navigate = useNavigate();
  const [requested, setRequested] = useState(false);

  return (
    <div className="min-h-screen bg-[#08080B] text-white antialiased overflow-x-hidden">
      <LinguaCursor />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08080B]/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-white">Lingua</span>
            <span style={{ color: DECK.green }}>Script</span>
          </span>
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

      {/* ── Hero ── */}
      <Section className="pt-24 pb-16 text-center">
        <motion.p
          initial="hidden"
          animate="visible"
          variants={reveal}
          className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-7"
        >
          The Chameleon Method
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

        <motion.div initial="hidden" animate="visible" custom={3} variants={reveal}>
          <StoreBadges className="mb-5" />
          <p className="text-xs text-white/35">Free to start · No card required</p>
        </motion.div>
      </Section>

      <Section className="pb-24">
        <PlatformLogos />
      </Section>

      {/* ── The wordmark, alive ── */}
      <section className="relative py-16 overflow-hidden border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <LiveWordmark className="mb-6" />
          <p className="text-sm text-white/35 max-w-md mx-auto">
            Drag across it. The name does what the app does.
          </p>
        </div>
      </section>

      {/* ── The gift ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <FreeChameleonGift />
      </Section>

      {/* ── How it works ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-14">
          Four steps. That's the method.
        </h2>
        <div className="grid gap-px sm:grid-cols-2 bg-white/[0.06] rounded-2xl overflow-hidden">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={i}
              variants={reveal}
              className="bg-[#08080B] p-7"
            >
              <s.icon className="w-5 h-5 mb-4" style={{ color: DECK[s.tier] }} />
              <h3 className="font-bold mb-2.5">
                <span className="text-white/30 mr-2">{i + 1}</span>
                {s.title}
              </h3>
              <p className="text-sm text-white/45 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Try it: the colour-shift demo from landingpage2 ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-5">
          Try it right here
        </p>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-4">
          Tap a word.
          <br />
          <span style={{ color: DECK.green }}>Watch him change.</span>
        </h2>
        <p className="text-white/45 max-w-xl mb-12">
          This is the whole product in one line of subtitle. Tap the red words
          until the line is green.
        </p>
        <div data-cursor="hot">
          <LandingChameleonDemo />
        </div>
      </Section>

      {/* ── The three decks ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Three colours. That's the system.
        </h2>
        <p className="text-white/45 max-w-xl mb-12">
          The same three everywhere — flashcards, the player, and both overlays.
        </p>
        <DeckCards />

        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {(
            [
              { tier: "red", label: "Unknown", d: "A word you've never met. Tap it once and it's saved." },
              { tier: "orange", label: "Learning", d: "You're learning it. It resurfaces until it sticks." },
              { tier: "green", label: "Known", d: "You know it. It stops interrupting and starts counting." },
            ] as const
          ).map((s, i) => (
            <motion.div
              key={s.tier}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={i}
              variants={reveal}
            >
              <div className="w-24 mb-4">
                <ChameleonMascot tier={s.tier} />
              </div>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2"
                style={{ color: DECK[s.tier] }}
              >
                {s.label}
              </p>
              <p className="text-sm text-white/45 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Students ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-8 sm:p-10 text-center">
          <div
            className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-5"
            style={{ backgroundColor: `${DECK.green}22`, border: `1px solid ${DECK.green}55` }}
          >
            <GraduationCap className="w-6 h-6" style={{ color: DECK.green }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
            Students get Pro for free
          </h2>
          <p className="text-white/45 text-sm max-w-md mx-auto mb-6">
            If you're studying a language at school, college or university, request a
            student account and we'll unlock LinguaScript Pro at no cost.
          </p>
          {requested ? (
            <p className="text-sm" style={{ color: DECK.green }}>
              Thanks — your request is on its way. We'll email your Pro link shortly.
            </p>
          ) : (
            <MagneticButton
              onClick={() => {
                setRequested(true);
                window.location.href =
                  "mailto:hello@linguascript.co.uk?subject=Student%20Pro%20request&body=Hi%20LinguaScript%2C%0A%0AI%27d%20like%20a%20free%20student%20Pro%20account.%0A%0ASchool%2Fcollege%3A%0ALanguage%20I%27m%20studying%3A%0AAccount%20email%3A%0A";
              }}
              className="px-7 py-3.5 rounded-xl font-bold text-[#08080B] inline-flex items-center gap-2"
              style={{ backgroundColor: DECK.green }}
            >
              <GraduationCap className="w-4 h-4" /> Request a student account
            </MagneticButton>
          )}
        </div>
      </Section>

      {/* ── Plans ── */}
      <Section className="py-24 border-t border-white/[0.06]">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">Or go Pro.</h2>
        <p className="text-white/45 mb-12">Everything in the method, without limits.</p>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-70px" }}
              custom={i}
              variants={reveal}
              className="rounded-2xl border p-6 text-center"
              style={{
                borderColor: p.highlight ? `${DECK.green}66` : "rgba(255,255,255,.10)",
                backgroundColor: p.highlight ? `${DECK.green}0D` : "transparent",
              }}
            >
              {p.highlight && (
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] mb-2"
                  style={{ color: DECK.green }}
                >
                  Most popular
                </span>
              )}
              <p className="font-semibold text-white/70">{p.name}</p>
              <p className="text-4xl font-extrabold mt-1 mb-1">
                {p.price}
                <span className="text-sm font-normal text-white/40"> {p.period}</span>
              </p>
              <p className="text-xs text-white/35">{p.note}</p>
            </motion.div>
          ))}
        </div>

        <ul className="grid sm:grid-cols-2 gap-2.5 mb-10">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-white/50">
              <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: DECK.green }} />
              {f}
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-center gap-4">
          <MagneticButton
            onClick={() => navigate("/pricing")}
            className="px-8 py-4 rounded-xl font-bold text-lg text-[#08080B]"
            style={{ backgroundColor: DECK.green }}
          >
            See Pro plans
          </MagneticButton>
          <button
            type="button"
            onClick={() => navigate("/onboarding")}
            className="text-sm text-white/40 underline underline-offset-4 hover:text-white transition-colors"
          >
            Continue with the free plan
          </button>
        </div>
      </Section>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm font-extrabold tracking-tight">
            <span className="text-white">Lingua</span>
            <span style={{ color: DECK.green }}>Script</span>
          </span>
          <p className="text-xs text-white/30">© {new Date().getFullYear()} LinguaScript</p>
        </div>
      </footer>
    </div>
  );
}
