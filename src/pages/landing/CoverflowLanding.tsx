// /landing6 — the "Films you'll actually understand" landing page.
// Order follows docs/POSITIONING.md §7: promise → interactive proof (the fan,
// personalised by hobby) → three proof points → who it's for → how it works →
// works everywhere → trust → questions → one button. Every claim is something
// the app does today (no speaking/writing course promises until they're back
// in the menus). The hobby picked here is carried into /onboarding.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { trackAll } from "@/lib/experiments";
import { CoverflowFan, FAN_HOBBIES, savedHobby, type FanCard } from "@/components/landing/CoverflowFan";
import "./coverflow-landing.css";

const PROOF: [string, string, string, string][] = [
  ["g", "≈ 50%", "of everything people say is the 100 most common words.", "/words"],
  ["o", "95%", "known words is the sweet spot. We check every video against your words first.", "/learn/comprehensible-input"],
  ["au", "2 min", "of gold reviews a day bring each word back after 1, 3, 7, 14 and 30 days.", "/learn/high-frequency-words"],
];
const PAINS = ["You did the apps, but real people still talk too fast.", "Subtitles go by and you don't know which words matter.", "You learn a word on Monday and it's gone by Friday."];
const STEPS: [string, string, string][] = [
  ["r", "1 · Learn", "Start with the most common words: the 100 behind half of real speech, then the next 900."],
  ["o", "2 · Watch", "Watch videos about what you love with dual subtitles. Tap any word: it's saved as red."],
  ["g", "3 · Keep", "Short reviews move it red → orange → green. Green words light up in every video you watch."],
];
const EVERYWHERE = ["🧩 Chrome extension: YouTube, Netflix, any website", "📱 Android: tap subtitles, widgets, lock-screen words", "📷 Scan a page of a real book", "🗂️ Export to Anki or Quizlet", "🤖 Quiz yourself in ChatGPT or Claude"];
const FAQ: [string, string][] = [
  ["Is it free?", "Yes, you can start for free on the web, in Chrome and on Android."],
  ["Who is it for?", "Adults and teens (16+) who are beginners or feel stuck: you know some words but can't follow real people talking yet."],
  ["Do I need Netflix?", "No. YouTube is free and has videos about every hobby. Netflix, Crunchyroll and TV5MONDE work with the Chrome extension if you have them."],
  ["How long does it take each day?", "As little as 10 minutes: a few reviews and one short video."],
  ["Which languages?", "Most-common-word lists for Spanish, French, German, Italian, Portuguese and English, and subtitles for any YouTube video that has them."],
];

const ONBOARDING_KEY = "ls.onboardingState.v1";

export default function CoverflowLanding() {
  const navigate = useNavigate();
  const [hobby, setHobby] = useState(() => savedHobby() ?? "football");
  const atHome = typeof window !== "undefined" && window.location.pathname === "/";

  /** Carry the hobby into onboarding so the visitor doesn't pick it twice. */
  const start = (from: string) => {
    trackAll("cta", { from });
    try {
      const s = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || "{}") || {};
      if (!s.interests?.length) localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...s, interests: [hobby] }));
    } catch { /* private mode: onboarding just asks again */ }
    navigate("/onboarding");
  };
  const label = FAN_HOBBIES.find((h) => h.id === hobby)?.label ?? "what you love";

  return (
    <div className="cfl">
      <Seo title="LinguaScript: learn the words that matter, in videos you love" rawTitle path={atHome ? "/" : "/landing6"} noindex={!atHome}
        description="Learn the most common words first, then watch YouTube, films and anime you'll actually understand. Tap a word to save it; it turns green as you learn it. Free to start." />
      <div className="glow" aria-hidden />
      <header className="wrap nav">
        <Link className="brand" to="/"><img src="/logo.svg" alt="" width={60} height={30} />LinguaScript</Link>
        <nav className="navl">
          <a className="hide" href="/learn">How it works</a>
          <a className="hide" href="/words">Free word lists</a>
          <Link to="/auth">Log in</Link>
          <button className="btn sm" onClick={() => start("nav")}>Start free</button>
        </nav>
      </header>

      <section className="wrap hero">
        <span className="eb">Discover</span>
        <h1>Films you'll <em>actually understand.</em></h1>
        <p className="lead">Learn the most common words first. Then watch videos about {label.toLowerCase()} and see every word you know light up <span className="g">green</span>.</p>
        <CoverflowFan hobby={hobby} onHobby={setHobby} onStart={(c: FanCard) => start(`card-${c.plat}`)} />
        <button className="btn" onClick={() => start("hero")}>Start free with {label} →</button>
      </section>

      <section className="wrap">
        <span className="eb">Why it works</span>
        <div className="grid3">
          {PROOF.map(([c, n, t, href]) => (
            <div key={n} className="box"><span className={`big ${c}`}>{n}</span><p>{t}</p><a className="src" href={href}>Where this comes from →</a></div>
          ))}
        </div>
      </section>

      <section className="wrap">
        <span className="eb">Sound familiar?</span>
        <h2 style={{ marginTop: 14 }}>Stuck between the apps <em>and real life?</em></h2>
        <div className="grid3">{PAINS.map((p) => <div key={p} className="box"><p style={{ color: "var(--fg)", fontSize: 18 }}>{p}</p></div>)}</div>
        <p className="lead" style={{ marginTop: 24 }}>LinguaScript fixes the order: the words you'll hear most, first, then real videos you can follow.</p>
      </section>

      <section className="wrap">
        <span className="eb">The Chameleon Method</span>
        <h2 style={{ marginTop: 14 }}>Words change colour <em>as you learn them.</em></h2>
        <div className="grid3">
          {STEPS.map(([c, t, d]) => <div key={t} className="box"><h3 className={c}>{t}</h3><p>{d}</p></div>)}
        </div>
        <p className="lead" style={{ marginTop: 20 }} translate="no">
          <span className="r">rouge</span> → <span className="o">orange</span> → <span className="g">vert</span> → <span className="au">or</span> → <span className="bl">bleu</span>
          <span translate="yes" style={{ display: "block", fontSize: 15, marginTop: 6 }}>new → learning → known → quick review → 100% yours</span>
        </p>
      </section>

      <section className="wrap">
        <span className="eb">Works everywhere you watch and read</span>
        <div className="chips">{EVERYWHERE.map((e) => <span key={e}>{e}</span>)}</div>
      </section>

      <section className="wrap">
        <span className="eb">Trust</span>
        <h2 style={{ marginTop: 14 }}>Built on research, <em>not hype.</em></h2>
        <div className="grid3">
          <a className="box" href="/learn/high-frequency-words" style={{ textDecoration: "none" }}><h3>High-frequency words ↗</h3><p>Why a few hundred words cover most of what you hear, with sources.</p></a>
          <a className="box" href="/learn/comprehensible-input" style={{ textDecoration: "none" }}><h3>Comprehensible input ↗</h3><p>Why understanding most of a video is how new words stick.</p></a>
          <a className="box" href="/learn/kato-lomb-chameleon-method" style={{ textDecoration: "none" }}><h3>Kató Lomb ↗</h3><p>The polyglot of 16 languages whose method inspired ours.</p></a>
        </div>
        <div className="box" style={{ marginTop: 16, gridTemplateColumns: "56px 1fr", alignItems: "center" }}>
          <img src="/logo.svg" alt="" width={56} height={28} />
          <p>Built in Falmouth, Cornwall by Rowan Francois. Questions? <a href="mailto:rowan@linguascript.co.uk" className="g">rowan@linguascript.co.uk</a></p>
        </div>
      </section>

      <section className="wrap" style={{ maxWidth: 820 }}>
        <span className="eb">Questions</span>
        {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <section className="wrap final">
        <img src="/logo.svg" alt="" width={96} height={48} />
        <h2>Learn from what <em>you love.</em></h2>
        <p className="lead">Free to start. Works on the web, in Chrome and on Android.</p>
        <button className="btn" onClick={() => start("final")}>Start free →</button>
      </section>

      <footer className="foot">
        <span>© LinguaScript Ltd</span>
        <a href="/learn">Learn</a><a href="/words">Word lists</a><Link to="/frequent-words">Most common words</Link>
        <Link to="/for-schools">Schools</Link><Link to="/pricing">Pricing</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}
