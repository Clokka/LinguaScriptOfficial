import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Seo } from "@/components/Seo";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { LineBlastDemo } from "@/components/LineBlastDemo";
import { PlatformLogos } from "@/components/landing/PlatformLogos";
import { DECK } from "@/lib/deck-colors";
import { BrandMark } from "@/components/BrandMark";
import { trackAll } from "@/lib/experiments";

/**
 * Landing page "clear" — the challenger in the `landing_page` A/B test.
 *
 * Built to answer three questions in the first screen, before any scrolling:
 * what is it, who is it for, what do I tap. One green button, repeated, that
 * always works (no store badges that can be disabled). Every claim here is
 * something the app already does — no invented numbers or testimonials.
 */

const LANGS = ["🇫🇷 French", "🇪🇸 Spanish", "🇯🇵 Japanese", "🇩🇪 German", "🇮🇹 Italian", "🇨🇳 Chinese", "🇵🇹 Portuguese", "🇹🇭 Thai"];

const STEPS = [
  { tier: "red" as const, title: "Pick a show", text: "Choose something you'd watch anyway, at your level." },
  { tier: "orange" as const, title: "Tap any word", text: "Two subtitle lines. Tap a word to translate and save it." },
  { tier: "green" as const, title: "Watch it go green", text: "Short reviews bring words back until they're yours." },
];

const FAQ = [
  { q: "Is it free?", a: "Yes, you can start free. Pro adds extra features, with a free trial first." },
  { q: "What level do I need?", a: "Any. Total beginners get easy videos and the most common words first." },
  { q: "Where does it work?", a: "In your browser, with YouTube, and on the phone app." },
];

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }),
};

const LandingClear = () => {
  const navigate = useNavigate();
  const start = () => {
    trackAll("cta");
    navigate("/onboarding");
  };

  const Cta = ({ label = "Start learning free" }: { label?: string }) => (
    <button
      onClick={start}
      className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg text-[#08080B] transition-transform active:scale-[0.98] hover:brightness-110"
      style={{ backgroundColor: DECK.green }}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#08080B] text-white antialiased overflow-x-hidden pb-20 sm:pb-0">
      <Seo
        title="LinguaScript: learn a language by watching shows you love"
        description="Two subtitle lines, tap-to-translate and short reviews that turn every word you know green. Start free."
        path="/"
        rawTitle
      />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08080B]/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight">
            Lingua<span style={{ color: DECK.green }}>Script</span>
          </span>
          <button
            onClick={() => navigate("/auth")}
            className="px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero: what, who, what to tap */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 text-center">
        <motion.div initial="hidden" animate="visible" variants={reveal} className="w-20 mx-auto mb-6">
          <ChameleonMascot tier="green" />
        </motion.div>
        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={reveal}
          className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]"
        >
          Learn a language by watching{" "}
          <span style={{ color: DECK.green }}>shows you already love.</span>
        </motion.h1>
        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={reveal}
          className="mt-5 text-lg sm:text-xl text-white/70"
        >
          Two subtitle lines, tap any word to translate it, and short reviews that turn the words you know green.
        </motion.p>
        <motion.div initial="hidden" animate="visible" custom={3} variants={reveal} className="mt-8">
          <Cta />
          <p className="mt-3 text-sm text-white/45">Free to start · No card needed · Takes 1 minute</p>
        </motion.div>
        <motion.div
          initial="hidden"
          animate="visible"
          custom={4}
          variants={reveal}
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {LANGS.map((l) => (
            <span key={l} className="px-3 py-1.5 rounded-full text-sm bg-white/[0.06] text-white/75" translate="no">
              {l}
            </span>
          ))}
        </motion.div>
      </section>

      {/* Try it right here */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.06]">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">Try it right now.</h2>
        <p className="text-white/60 mb-8">This is the real app. Finish the line.</p>
        <LineBlastDemo />
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.06]">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-10">How it works</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              custom={i}
              variants={reveal}
            >
              <div className="w-16 mb-4">
                <ChameleonMascot tier={s.tier} />
              </div>
              <p className="text-sm font-semibold text-white/40 mb-1">Step {i + 1}</p>
              <h3 className="text-xl font-bold mb-2">{s.title}</h3>
              <p className="text-white/65">{s.text}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Cta label="Pick my first show" />
        </div>
      </section>

      {/* Where it works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 border-t border-white/[0.06]">
        <PlatformLogos />
      </section>

      {/* FAQ: answer the reasons people leave */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.06]">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-8">Questions</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl bg-white/[0.04] px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold flex justify-between items-center">
                {f.q}
                <span className="text-white/40 group-open:rotate-45 transition-transform text-xl">+</span>
              </summary>
              <p className="mt-3 text-white/65">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 border-t border-white/[0.06] text-center">
        <div className="w-28 mx-auto mb-6">
          <ChameleonMascot tier="green" party />
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-8">Start with tonight's episode.</h2>
        <Cta />
      </section>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <BrandMark size={28} className="opacity-80" />
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
            <a href="/privacy" className="hover:text-white/80">Privacy Policy</a>
            <a href="/terms" className="hover:text-white/80">Terms of Service</a>
            <a href="mailto:rowan@linguascript.co.uk" className="hover:text-white/80">Contact</a>
            <span className="text-white/30">© {new Date().getFullYear()} LinguaScript</span>
          </div>
        </div>
      </footer>

      {/* Sticky CTA on phones so the button is always one tap away */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 p-3 bg-[#08080B]/90 backdrop-blur border-t border-white/[0.06]">
        <button
          onClick={start}
          className="w-full py-3.5 rounded-xl font-bold text-[#08080B]"
          style={{ backgroundColor: DECK.green }}
        >
          Start learning free
        </button>
      </div>
    </div>
  );
};

export default LandingClear;
