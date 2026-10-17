import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, MousePointerClick, Layers, Sparkles, ArrowRight, ArrowDown, Check, Lock, GraduationCap, BookOpenCheck, ShieldCheck, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { BrandMark } from "@/components/BrandMark";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { PlatformLogos } from "@/components/landing/PlatformLogos";
import { StoreBadges, type Store } from "@/components/landing/StoreBadges";
import { CoreLoopDemo } from "@/components/landing/CoreLoopDemo";
import { captureAttribution } from "@/lib/experiments";
import { guessLearnLang, saveLearnLang, nativeLang, LEARN_LANGS, type LearnLang } from "@/lib/landingSegment";
import { demoLine } from "@/lib/landingDemoLines";
import { COURSES } from "@/lib/landingCourses";
import { DECK } from "@/lib/deck-colors";

/**
 * /landing — explain LinguaScript in five seconds, then let people try it.
 *
 *  - The demo IS the explanation: the real orange ring, word popup and
 *    flashcards. No copy tells anyone what to do; the ring does.
 *  - One main action: "Try LinguaScript free" → onboarding.
 *  - Chrome extension, Google Play and App Store next to it. Store links that
 *    aren't live yet say "Coming soon" and offer an email heads-up instead.
 *  - Gentle, inbound: honest about who it's for (A1+), and points beginners to
 *    free courses for their language rather than selling to them.
 */

const STORE_NAME: Record<Store, string> = { chrome: "Chrome", android: "Google Play", ios: "the App Store" };

const FLOW = [
  { icon: Play, label: "Watch a show with two subtitle lines" },
  { icon: MousePointerClick, label: "Tap a word. It goes into your flashcards" },
  { icon: Layers, label: "Review it: red → orange → green" },
  { icon: Sparkles, label: "Green for the first time? It turns gold" },
];

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }),
};

/** One-field email form for "tell me when the app is out". */
const NotifyForm = ({ store, lang, onDone }: { store: Store; lang: string; onDone: () => void }) => {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setState("error"); return; }
    setState("sending");
    const { source, campaign } = captureAttribution();
    const { error } = await (supabase as any)
      .from("email_signups")
      .insert({ email: value, source: `${[source, campaign].filter(Boolean).join(" / ")} · learn:${lang} · wants:${store}`.slice(0, 120) });
    if (error && error.code !== "23505") { setState("error"); return; } // 23505 = already on the list
    onDone();
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md mx-auto" noValidate>
      <p className="mb-2 text-sm text-white/70">Get a heads-up when it's on {STORE_NAME[store]}:</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="notify-email" className="sr-only">Email address</label>
        <input
          id="notify-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setState("idle"); }}
          className="w-full sm:flex-1 h-12 px-4 rounded-xl bg-white/[0.07] border border-white/15 text-base text-white placeholder:text-white/40 outline-none focus:border-white/40"
        />
        <button type="submit" disabled={state === "sending"} className="h-12 px-5 rounded-xl font-semibold bg-white text-[#08080B] hover:bg-white/90 disabled:opacity-60">
          {state === "sending" ? "Saving…" : "Notify me"}
        </button>
      </div>
      <p className="mt-2 text-xs flex items-center justify-center gap-1.5" style={{ color: state === "error" ? "#FF6B60" : "rgba(255,255,255,.45)" }}>
        {state === "error" ? "Please enter a valid email." : <><Lock className="w-3 h-3" /> One email when it launches. No spam.</>}
      </p>
    </form>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<LearnLang>(() => guessLearnLang().lang);
  const [notify, setNotify] = useState<Store | null>(null);
  const [notified, setNotified] = useState(false);
  const line = useMemo(() => demoLine(lang, nativeLang()), [lang]);
  const langLabel = LEARN_LANGS.find((l) => l.code === lang)?.label ?? "French";
  const courses = COURSES[lang] ?? [];

  useEffect(() => { captureAttribution(); }, []);

  const pickLang = (l: LearnLang) => { setLang(l); saveLearnLang(l); };
  const tryIt = () => navigate("/onboarding");
  const soon = (s: Store) => { setNotify(s); setNotified(false); };

  const FAQ: { q: string; a: React.ReactNode }[] = [
    {
      q: "What level do I need?",
      a: "LinguaScript builds vocabulary. It works best once you know the alphabet and the basics (around A1 to A2), alongside a course or class for grammar.",
    },
    {
      q: `Not at A1 in ${langLabel} yet?`,
      a: courses.length ? (
        <>
          <span>Start with a free beginner course, then come back to grow your vocabulary with shows you love:</span>
          <span className="mt-3 flex flex-col gap-2">
            {courses.map((c) => (
              <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl bg-white/[0.05] p-3 hover:bg-white/[0.08]">
                <ExternalLink className="w-4 h-4 mt-1 shrink-0" style={{ color: DECK.green }} />
                <span>
                  <span className="block font-semibold text-white">{c.name}</span>
                  <span className="block text-sm text-white/55">{c.by} · {c.note}</span>
                </span>
              </a>
            ))}
          </span>
        </>
      ) : (
        <span>We're choosing a free beginner course for {langLabel}. Email <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a> and we'll send you our pick.</span>
      ),
    },
    { q: "Is it free?", a: "Yes. You can learn a set number of new words every day for free. Pro removes the limit." },
    { q: "Where does it work?", a: "In your browser today. The Chrome extension adds it to YouTube and Netflix, and the phone apps are on the way." },
    { q: "Which languages?", a: "French, Spanish, Japanese, German, Italian, Chinese, Portuguese, Thai and English." },
  ];

  return (
    <div className="min-h-screen bg-[#08080B] text-white antialiased overflow-x-hidden pb-20 sm:pb-0">
      <Seo
        title="LinguaScript: learn languages while watching your favourite shows"
        description="Tap a word you don't know in any show. It goes into your flashcards and turns green in every video once you know it. Try it free."
        path="/landing"
        rawTitle
      />

      <header className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <BrandMark size={32} />
        <div className="flex items-center gap-2 text-sm text-white/50">
          <label htmlFor="learn-lang" className="hidden sm:inline">Learning</label>
          <select
            id="learn-lang"
            aria-label="Language you're learning"
            value={lang}
            onChange={(e) => pickLang(e.target.value as LearnLang)}
            className="rounded-lg bg-white/[0.07] border border-white/15 px-2 py-1 text-white outline-none"
          >
            {LEARN_LANGS.map((l) => <option key={l.code} value={l.code} className="bg-[#16161c]">{l.flag} {l.label}</option>)}
          </select>
        </div>
      </header>

      {/* ── Hero: headline, the playable loop, try it ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-2 sm:pt-10 pb-14 text-center">
        <motion.h1
          initial="hidden" animate="visible" variants={reveal}
          className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]"
        >
          Learn languages while{" "}
          <span style={{ color: DECK.green }}>watching your favourite shows.</span>
        </motion.h1>

        <motion.div initial="hidden" animate="visible" custom={1} variants={reveal} className="mt-6 text-left">
          <CoreLoopDemo line={line} language={lang} languageLabel={langLabel} onTry={tryIt} />
        </motion.div>

        <motion.div initial="hidden" animate="visible" custom={2} variants={reveal} className="mt-8">
          <button
            onClick={tryIt}
            className="w-full sm:w-auto px-8 h-14 rounded-xl font-bold text-lg text-[#08080B] hover:brightness-110 transition inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: DECK.green }}
          >
            Try LinguaScript free <ArrowRight className="w-5 h-5" />
          </button>
          <p className="mt-2 text-sm text-white/45">Free · No card needed · Works in your browser</p>
          <StoreBadges className="mt-5" chromeFirst onSoon={soon} />
          {notify && (
            <div className="mt-4">
              {notified ? (
                <p className="text-sm flex items-center justify-center gap-2" style={{ color: DECK.green }} role="status">
                  <Check className="w-4 h-4" /> Done. We'll email you when it's on {STORE_NAME[notify]}.
                </p>
              ) : (
                <NotifyForm store={notify} lang={lang} onDone={() => setNotified(true)} />
              )}
            </div>
          )}
        </motion.div>
      </section>

      {/* ── Where it works ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 border-t border-white/[0.06]">
        <PlatformLogos />
      </section>

      {/* ── How it works ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 border-t border-white/[0.06] text-center">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-8">How it works</h2>
        <ol className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-1">
          {FLOW.map((f, i) => (
            <li key={f.label} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-1">
              <div className="flex items-center gap-3 sm:flex-col sm:gap-2 px-4 py-3 rounded-xl bg-white/[0.05] w-64 sm:w-40 sm:h-32 sm:justify-center">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style={{ backgroundColor: `${DECK.green}22`, color: DECK.green }}>
                  <f.icon className="w-5 h-5" />
                </span>
                <span className="text-sm font-semibold text-white/85 text-left sm:text-center">{f.label}</span>
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
        {/* Quiet numbers, no pitch */}
        <p className="mt-8 text-xs text-white/35">
          Most common words first · 100 words ≈ 50% of written English · 3,000 ≈ 95% of everyday conversation
        </p>
      </section>

      {/* ── Trust ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/[0.06]">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: GraduationCap, title: "Made by a TEFL-certified teacher", text: "Designed by someone who teaches languages." },
            { icon: BookOpenCheck, title: "Built on word-frequency research", text: "You learn the words you'll hear most, first." },
            { icon: ShieldCheck, title: "Your data stays private", text: "UK GDPR. Never sold. Delete it any time." },
            { icon: Building2, title: "A real UK company", text: "LinguaScript Ltd, registered in England & Wales." },
          ].map((t) => (
            <div key={t.title} className="flex gap-3 rounded-xl bg-white/[0.04] p-4">
              <t.icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: DECK.green }} />
              <div>
                <p className="font-semibold">{t.title}</p>
                <p className="text-sm text-white/55">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-white/[0.04] p-6 flex items-center gap-4">
          <div className="w-14 shrink-0"><ChameleonMascot tier="green" /></div>
          {/* Rowan: swap in a short line in your own words about why you're building this. */}
          <p className="text-white/75">
            Built in Falmouth, Cornwall. Questions? Email me at{" "}
            <a href="mailto:rowan@linguascript.co.uk" className="underline" style={{ color: DECK.green }}>rowan@linguascript.co.uk</a>.
            <span className="block mt-1 text-sm text-white/45">Rowan Francois, founder</span>
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/[0.06]">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-8">Questions</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl bg-white/[0.04] px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold flex justify-between items-center gap-4">
                {f.q}
                <span className="text-white/40 group-open:rotate-45 transition-transform text-xl">+</span>
              </summary>
              <div className="mt-3 text-white/65 flex flex-col">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final ask ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.06] text-center">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-8">Start with tonight's episode.</h2>
        <button
          onClick={tryIt}
          className="w-full sm:w-auto px-8 h-14 rounded-xl font-bold text-lg text-[#08080B] hover:brightness-110 transition"
          style={{ backgroundColor: DECK.green }}
        >
          Try LinguaScript free
        </button>
      </section>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
          <span>© {new Date().getFullYear()} LinguaScript Ltd</span>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-white/80">Privacy Policy</a>
            <a href="/terms" className="hover:text-white/80">Terms</a>
            <a href="mailto:rowan@linguascript.co.uk" className="hover:text-white/80">Contact</a>
          </div>
        </div>
      </footer>

      {/* Sticky main button on phones (sits under popups and flashcards) */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 p-3 bg-[#08080B]/90 backdrop-blur border-t border-white/[0.06]">
        <button onClick={tryIt} className="w-full h-12 rounded-xl font-bold text-[#08080B]" style={{ backgroundColor: DECK.green }}>
          Try LinguaScript free
        </button>
      </div>
    </div>
  );
};

export default Landing;
