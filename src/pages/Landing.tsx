import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, MousePointerClick, Layers, Sparkles, ArrowRight, ArrowDown, Check, Lock, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { BrandMark } from "@/components/BrandMark";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { ProductDemoPlayer } from "@/components/ProductDemoPlayer";
import { PlatformLogos } from "@/components/landing/PlatformLogos";
import { captureAttribution } from "@/lib/experiments";
import { DECK } from "@/lib/deck-colors";

/**
 * /landing — pre-launch early-access page.
 *
 * Kept deliberately plain (layout follows /landingpage2), built on what
 * conversion research agrees on:
 *  - one goal, no nav links: the only action is "join early access"
 *  - benefit headline + the product demo in the first screen
 *  - one field (email); every extra field costs completions
 *  - trust: real founder, real company, privacy promise, no fake numbers
 *  - signup counter shown only once it is big enough to help
 *  - after signup: say what happens next and give a share button
 */

const FLOW = [
  { icon: Play, label: "Watch a video" },
  { icon: MousePointerClick, label: "Tap a word to save it" },
  { icon: Layers, label: "Review it as a flashcard" },
  { icon: Sparkles, label: "Understand more next time" },
];

const FAQ = [
  { q: "When does it launch?", a: "Very soon. Early-access members get in first, before everyone else." },
  { q: "Will it cost anything?", a: "Joining the list is free. Early-access members will be able to start free." },
  { q: "Which languages?", a: "French, Spanish, Japanese, German, Italian, Chinese, Portuguese and Thai to start." },
  { q: "What will you do with my email?", a: "Only tell you about LinguaScript. No spam, never sold, unsubscribe in one click." },
];

const SHOW_COUNT_FROM = 100; // a small number hurts trust, so hide it until then
const SHARE_URL = "https://linguascript.co.uk/landing";

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }),
};

/** One-field email form, used at the top and bottom of the page. */
const SignupForm = ({ id, onDone }: { id: string; onDone: () => void }) => {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState("error");
      setError("Please enter a valid email.");
      return;
    }
    setState("sending");
    const { source, campaign } = captureAttribution();
    const { error: err } = await (supabase as any)
      .from("email_signups")
      .insert({ email: value, source: [source, campaign].filter(Boolean).join(" / ").slice(0, 120) || null });
    if (err && err.code !== "23505") {
      // 23505 = already on the list, which counts as success
      setState("error");
      setError("Something went wrong. Please try again.");
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md mx-auto" noValidate>
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={id} className="sr-only">Email address</label>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setState("idle"); }}
          className="w-full sm:flex-1 h-14 px-4 rounded-xl bg-white/[0.07] border border-white/15 text-base text-white placeholder:text-white/40 outline-none focus:border-white/40"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="h-14 px-6 rounded-xl font-bold text-base text-[#08080B] hover:brightness-110 disabled:opacity-60 transition"
          style={{ backgroundColor: DECK.green }}
        >
          {state === "sending" ? "Joining…" : "Get early access"}
        </button>
      </div>
      {state === "error" ? (
        <p className="mt-2 text-sm text-[#FF6B60]" role="alert">{error}</p>
      ) : (
        <p className="mt-3 text-sm text-white/45 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Free · No spam · Unsubscribe anytime
        </p>
      )}
    </form>
  );
};

/** Shown after signup: confirm, say what's next, and make sharing one tap. */
const Joined = () => {
  const text = "I just got early access to LinguaScript, learn a language by watching your favourite shows 🦎";
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "LinguaScript", text, url: SHARE_URL });
        return;
      }
    } catch { /* user closed the share sheet */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${SHARE_URL}`)}`, "_blank", "noopener");
  };
  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-white/[0.05] border border-white/10 p-6 text-center" role="status">
      <div className="w-16 mx-auto mb-3"><ChameleonMascot tier="green" party /></div>
      <p className="text-xl font-bold flex items-center justify-center gap-2">
        <Check className="w-5 h-5" style={{ color: DECK.green }} /> You're on the list!
      </p>
      <p className="mt-2 text-white/65">We'll email you the moment LinguaScript opens. Know someone learning a language?</p>
      <button
        onClick={share}
        className="mt-5 w-full h-12 rounded-xl font-semibold bg-white text-[#08080B] hover:bg-white/90 inline-flex items-center justify-center gap-2"
      >
        <Share2 className="w-4 h-4" /> Share with a friend
      </button>
    </div>
  );
};

const Landing = () => {
  const [joined, setJoined] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    captureAttribution();
    (supabase as any).rpc("email_signup_count").then(({ data }: any) => {
      if (typeof data === "number") setCount(data);
    });
  }, []);

  const toForm = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => document.getElementById("email-top")?.focus(), 400);
  };

  const form = (id: string) => (joined ? <Joined /> : <SignupForm id={id} onDone={() => setJoined(true)} />);

  return (
    <div className="min-h-screen bg-[#08080B] text-white antialiased overflow-x-hidden pb-20 sm:pb-0">
      <Seo
        title="LinguaScript: learn languages while watching your favourite shows"
        description="See subtitles in two languages, tap any word you don't know, and LinguaScript turns it into flashcards. Join early access."
        path="/landing"
        rawTitle
      />

      {/* Logo only: no links that lead away from the one action */}
      <header className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center">
        <BrandMark size={32} />
      </header>

      {/* ── Hero: what it is, see it, sign up ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-12 pb-14 text-center">
        <motion.p
          initial="hidden" animate="visible" variants={reveal}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm bg-white/[0.06] text-white/80"
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: DECK.green }} />
          Early access · Launching soon
        </motion.p>
        <motion.h1
          initial="hidden" animate="visible" custom={1} variants={reveal}
          className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]"
        >
          Learn languages while{" "}
          <span style={{ color: DECK.green }}>watching your favourite shows.</span>
        </motion.h1>
        <motion.p
          initial="hidden" animate="visible" custom={2} variants={reveal}
          className="mt-4 text-lg sm:text-xl text-white/70"
        >
          See subtitles in two languages. Tap any word you don't know. We turn it into flashcards for you.
        </motion.p>

        <motion.div ref={topRef} initial="hidden" animate="visible" custom={3} variants={reveal} className="mt-8">
          {form("email-top")}
          {count !== null && count >= SHOW_COUNT_FROM && (
            <p className="mt-4 text-sm text-white/60">
              Join <strong className="text-white">{count.toLocaleString()}</strong> learners already on the list
            </p>
          )}
        </motion.div>

        {/* The demo explains it better than words */}
        <motion.div initial="hidden" animate="visible" custom={4} variants={reveal} className="mt-10 text-left">
          <ProductDemoPlayer />
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 border-t border-white/[0.06] text-center">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-8">How it works</h2>
        <ol className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-1">
          {FLOW.map((f, i) => (
            <li key={f.label} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-1">
              <div className="flex items-center gap-3 sm:flex-col sm:gap-2 px-4 py-3 rounded-xl bg-white/[0.05] w-64 sm:w-40 sm:h-32 sm:justify-center">
                <span
                  className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
                  style={{ backgroundColor: `${DECK.green}22`, color: DECK.green }}
                >
                  <f.icon className="w-5 h-5" />
                </span>
                <span className="text-sm font-semibold text-white/85 text-left sm:text-center">
                  <span className="text-white/40">{i + 1}. </span>{f.label}
                </span>
              </div>
              {i < FLOW.length - 1 && (
                <>
                  <ArrowDown className="sm:hidden w-4 h-4 text-white/30" />
                  <ArrowRight className="hidden sm:block w-4 h-4 text-white/30" />
                </>
              )}
            </li>
          ))}
        </ol>

        {/* Progress you can see: the chameleon colours */}
        <div className="mt-14 grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {[
            { tier: "red" as const, label: "New word", c: DECK.red },
            { tier: "orange" as const, label: "Learning", c: DECK.orange },
            { tier: "green" as const, label: "Known", c: DECK.green },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <div className="w-16 sm:w-20"><ChameleonMascot tier={s.tier} /></div>
              <p className="mt-2 text-xs sm:text-sm font-bold uppercase tracking-wider" style={{ color: s.c }}>{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-white/60">Every word changes colour as you learn it. Watch your show turn green.</p>
      </section>

      {/* ── Where it works ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 border-t border-white/[0.06]">
        <PlatformLogos />
      </section>

      {/* ── Trust: a real person and a real company ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/[0.06]">
        <div className="rounded-2xl bg-white/[0.04] p-6 sm:p-8">
          {/* Rowan: swap in a short line in your own words about why you're building this. */}
          <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-3">Who's behind it</p>
          <p className="text-lg text-white/80 leading-relaxed">
            LinguaScript is built by a small team in Falmouth, Cornwall. Got a question? Email me directly at{" "}
            <a href="mailto:rowan@linguascript.co.uk" className="underline" style={{ color: DECK.green }}>rowan@linguascript.co.uk</a>
            . I read every message.
          </p>
          <p className="mt-4 font-semibold">Rowan Francois</p>
          <p className="text-sm text-white/50">Founder · LinguaScript Ltd, registered in England &amp; Wales</p>
        </div>
      </section>

      {/* ── FAQ: answer the reasons people hesitate ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/[0.06]">
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

      {/* ── Final ask ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.06] text-center">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-8">Be first in line.</h2>
        {form("email-bottom")}
      </section>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
          <span>© {new Date().getFullYear()} LinguaScript Ltd</span>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-white/80">Privacy Policy</a>
            <a href="mailto:rowan@linguascript.co.uk" className="hover:text-white/80">Contact</a>
          </div>
        </div>
      </footer>

      {/* Sticky button on phones until they've joined */}
      {!joined && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 p-3 bg-[#08080B]/90 backdrop-blur border-t border-white/[0.06]">
          <button
            onClick={toForm}
            className="w-full h-12 rounded-xl font-bold text-[#08080B]"
            style={{ backgroundColor: DECK.green }}
          >
            Get early access
          </button>
        </div>
      )}
    </div>
  );
};

export default Landing;
