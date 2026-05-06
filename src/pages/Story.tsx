import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Languages, Sparkles, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const Story = () => {
  const navigate = useNavigate();

  // Load Instagram embed script
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.instagram.com/embed.js"]');
    if (existing) {
      // @ts-expect-error - instgrm is injected globally
      window.instgrm?.Embeds?.process?.();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const enterDemo = () => navigate("/browse");

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 hover:opacity-70 transition">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
              <Languages className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-neutral-900">LinguaScript</span>
          </button>
          <Button
            onClick={enterDemo}
            className="h-9 px-4 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium shadow-none"
          >
            Skip to Demo
          </Button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-orange-100/60 blur-3xl" />
          <div className="absolute top-40 -left-40 w-[420px] h-[420px] rounded-full bg-orange-50 blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200/70 rounded-full px-4 py-1.5 mb-7"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-medium text-orange-600 tracking-wide">A short story before you start</span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-[40px] sm:text-[56px] lg:text-[64px] leading-[1.05] font-semibold tracking-[-0.03em] text-neutral-900 mb-6"
          >
            Making language learning{" "}
            <span className="text-orange-500">free, fun, and accessible</span> to everyone.
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="text-lg sm:text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed mb-10 font-light"
          >
            Linguascript helps students learn languages through films using immersion, shadowing, and learning science — so progress feels natural, not forced.
          </motion.p>

          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <Button
              onClick={enterDemo}
              className="h-12 px-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[15px] font-medium shadow-[0_8px_24px_-8px_rgba(249,115,22,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(249,115,22,0.6)] transition-all hover:scale-[1.02] gap-2"
            >
              Continue to Demo
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* VIDEO */}
      <section className="relative py-12 sm:py-20 bg-neutral-50/60 border-y border-neutral-100">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200/70 rounded-full px-3 py-1 mb-4">
              <Play className="w-3 h-3" fill="currentColor" />
              60 seconds
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
              A 60-second explanation of Linguascript
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="flex justify-center"
          >
            <div className="w-full max-w-md rounded-3xl overflow-hidden bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] border border-neutral-100">
              <blockquote
                className="instagram-media"
                data-instgrm-permalink="https://www.instagram.com/reel/DX03hfKtTl2/?utm_source=ig_embed"
                data-instgrm-version="14"
                style={{
                  background: "#FFF",
                  border: 0,
                  margin: 0,
                  maxWidth: "540px",
                  minWidth: "280px",
                  padding: 0,
                  width: "100%",
                }}
              >
                <a href="https://www.instagram.com/reel/DX03hfKtTl2/" target="_blank" rel="noreferrer">
                  View this reel on Instagram
                </a>
              </blockquote>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STORY */}
      <section className="relative py-20 sm:py-28">
        <div className="max-w-2xl mx-auto px-6">
          <article className="space-y-10 text-[19px] sm:text-[21px] leading-[1.7] text-neutral-700 font-light">
            <StoryBlock>
              <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 leading-snug">
                What if there was a way to make language learning free, fun, and accessible to everyone?
              </p>
              <p className="mt-3 text-orange-500 font-medium">Well… there already is.</p>
            </StoryBlock>

            <StoryBlock>
              <p>
                Linguascript integrates with the content we already love — like{" "}
                <span className="font-medium text-neutral-900">YouTube</span>,{" "}
                <span className="font-medium text-neutral-900">BBC iPlayer</span>, and{" "}
                <span className="font-medium text-neutral-900">Netflix</span>.
              </p>
              <p className="mt-4">
                Using dual subtitles, spaced repetition, shadowing, and comprehensible input.
              </p>
            </StoryBlock>

            <Divider />

            <StoryBlock>
              <p>
                Learning is not always fun, but watching the content you already love is, right? 😅
              </p>
              <p className="mt-4">So learning while watching the content you already love is like…</p>
              <p className="mt-4 text-neutral-900 font-medium">
                tricking your brain into learning and it thanking you for the dopamine. 🤯
              </p>
            </StoryBlock>

            <Divider />

            <StoryBlock>
              <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 leading-snug">
                Hi, I'm Rowan.
              </p>
              <p className="mt-4">
                My grandad speaks 7 languages, so my lifelong dream has been to learn 8.
              </p>
              <p className="mt-4">
                Right now I'm working on{" "}
                <span className="text-2xl tracking-wide">🇫🇷 🇯🇵 🇹🇭 🇮🇹</span>
              </p>
            </StoryBlock>

            <StoryBlock>
              <p>The problem I kept running into was this:</p>
              <p className="mt-4 text-neutral-900 font-medium text-xl">
                Language learning today is neither free, fun, nor accessible.
              </p>
            </StoryBlock>

            <StoryBlock>
              <figure className="border-l-4 border-orange-400 pl-6 py-2 bg-orange-50/40 rounded-r-2xl">
                <blockquote className="text-xl sm:text-2xl italic text-neutral-800 font-light leading-snug">
                  "We do not rise to the level of our goals, we fall to the level of our systems."
                </blockquote>
                <figcaption className="mt-3 text-sm text-neutral-500">— Julius Caesar</figcaption>
              </figure>
              <p className="mt-6">That hit me hard.</p>
              <p className="mt-4">
                Because I realised motivation was never the issue.{" "}
                <span className="text-neutral-900 font-medium">The system was.</span>
              </p>
            </StoryBlock>

            <Divider />

            <StoryBlock>
              <p>
                Using this exact system, I went from{" "}
                <span className="font-medium text-neutral-900">A1 to B2 in French in one year.</span>
              </p>
              <p className="mt-4 text-orange-500 font-medium">That system became Linguascript.</p>
            </StoryBlock>

            <StoryBlock>
              <p>I read about Kátó Lomb, who learned 27 languages using:</p>
              <ul className="mt-5 space-y-3">
                {[
                  ["Autolexia", "Reading for pleasure"],
                  ["Autographia", "Writing for pleasure"],
                  ["Autologia", "Speaking for pleasure"],
                ].map(([name, desc]) => (
                  <li key={name} className="flex items-start gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                    <div className="mt-1 w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-neutral-900">{name}</span>
                      <span className="text-neutral-500"> — {desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </StoryBlock>

            <StoryBlock>
              <p className="text-neutral-900 font-medium">The revelation?</p>
              <p className="mt-3 text-xl sm:text-2xl tracking-tight text-neutral-900 leading-snug">
                When we enjoy something, progress comes naturally.
              </p>
            </StoryBlock>

            <Divider />

            <StoryBlock>
              <p>
                If you're an{" "}
                <span className="font-medium text-neutral-900">A-Level student</span>, try our recommended A-Level film guide and YouTube lessons.
              </p>
              <p className="mt-4">And if you're not — these principles still work for you.</p>
            </StoryBlock>

            <StoryBlock>
              <p>
                Because Linguascript connects learning with the content you already love, letting you{" "}
                <span className="font-medium text-neutral-900">habit-stack</span> language learning with entertainment.
              </p>
              <p className="mt-6 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 leading-snug">
                If learning feels real and enjoyable, progress becomes natural.
              </p>
            </StoryBlock>
          </article>
        </div>
      </section>

      {/* CTA */}
      <section className="relative pb-28 pt-10">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-gradient-to-br from-orange-50 via-white to-orange-50/50 border border-orange-100 p-10 sm:p-14"
          >
            <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900 mb-4">
              Ready when you are.
            </h3>
            <p className="text-neutral-500 mb-8 text-lg font-light">
              Step into the demo and start learning with the content you love.
            </p>
            <Button
              onClick={enterDemo}
              className="h-14 px-9 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-base font-medium shadow-[0_12px_32px_-8px_rgba(249,115,22,0.5)] hover:shadow-[0_16px_40px_-8px_rgba(249,115,22,0.6)] transition-all hover:scale-[1.02] gap-2"
            >
              Enter the Demo
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-neutral-100 py-8">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-neutral-400">
          © {new Date().getFullYear()} LinguaScript
        </div>
      </footer>
    </div>
  );
};

const StoryBlock = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

const Divider = () => (
  <div className="flex justify-center py-2">
    <div className="flex gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-orange-200" />
      <div className="w-1.5 h-1.5 rounded-full bg-orange-300" />
      <div className="w-1.5 h-1.5 rounded-full bg-orange-200" />
    </div>
  </div>
);

export default Story;
