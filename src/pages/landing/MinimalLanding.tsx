// /landing7 — the minimal homepage (Rowan, 26 Nov): one promise, one button,
// three honest facts. Make it the homepage (or A/B test it) in HQ → Today by
// typing /landing7. Facts follow docs/POSITIONING.md: "about half" because the
// top 100 words are 48–58% of film & TV words (src/data/wordlists), never more.
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { track } from "@/lib/analytics";

const FACTS = [
  { big: "~100 words", small: "about half of what's said in films & TV" },
  { big: "Red → green", small: "watch your words change colour as you learn" },
  { big: "Anki & Quizlet", small: "export your words any time" },
];

export default function MinimalLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0B0B0D] text-[#F2F2F5]">
      <Seo title="LinguaScript: learn the words that matter" description="Learn the most common words first, hear them in the shows you love, and watch them turn from red to green." path="/landing7" />
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="flex items-center gap-2 text-lg font-extrabold"><img src="/logo.svg" alt="" className="h-8 w-auto" /><span>Lingua<span className="text-[#34C759]">Script</span></span></span>
        <Link to="/auth" className="text-sm font-semibold text-[#A1A1AA] hover:text-white">Log in</Link>
      </nav>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-12 sm:px-6">
        <h1 className="max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Learn the words that matter. Hear them in the shows you love.</h1>
        <p className="mt-6 flex flex-wrap gap-x-3 text-2xl font-extrabold sm:text-3xl" translate="no" aria-label="Example: je vais regarder le match">
          <span className="text-[#FF3B30]">je</span><span className="text-[#FF8A00]">vais</span><span className="text-[#34C759]">regarder</span><span className="text-[#34C759]">le</span><span className="text-[#FF3B30]">match</span>
        </p>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#A1A1AA]">Watch YouTube and Netflix with the LinguaScript extension and app. Tap a word to save it, and see it turn green as you learn it.</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link to="/onboarding" onClick={() => track("cta_clicked", { from: "landing7", cta: "start_free" })}
            className="inline-flex h-14 items-center rounded-full bg-[#34C759] px-8 text-lg font-extrabold text-[#06210F] transition hover:brightness-110">Start free</Link>
          <span className="text-sm text-[#A1A1AA]">Chrome extension · Android app</span>
        </div>
      </main>

      <footer className="border-t border-[#1E1E23]">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:grid-cols-3 sm:px-6">
          {FACTS.map((f) => <div key={f.big}><b className="block text-xl font-extrabold">{f.big}</b><span className="text-sm text-[#A1A1AA]">{f.small}</span></div>)}
        </div>
        <div className="mx-auto flex max-w-5xl gap-4 px-4 pb-6 text-xs text-[#A1A1AA] sm:px-6">
          <a href="/words" className="hover:text-white">Most common words</a><a href="/learn" className="hover:text-white">How it works</a><Link to="/privacy" className="hover:text-white">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
