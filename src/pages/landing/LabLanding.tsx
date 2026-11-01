import { useNavigate, Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { trackAll } from "@/lib/experiments";
import "./lab-landing.css";

/**
 * The Design Lab looks as real landing pages, for the homepage A/B test
 * (src/components/landing/LandingPageTest.tsx). One page, three themes:
 *   gold  — black & gold, kinetic "Turn it red/orange/green/gold" hero
 *   glass — glass dark, Liquid-Glass film frame with live colouring subtitles
 *   split — black/white split, "Don't know it. / Know it." hero
 * Every claim on the page is something the app already does. Motion is CSS
 * only and switches off for "reduce motion".
 */
export type LabTheme = "gold" | "glass" | "split";

const SUBS: [string, string][] = [["Je", "--g"], ["voudrais", "--o"], ["un", "--g"], ["café", "--g"], ["noir,", "--r"], ["s'il", "--g"], ["vous", "--g"], ["plaît", "--a"]];
const DECKS = [["Top 50", "r", "le", "the"], ["Top 500", "o", "maison", "house"], ["Top 1,000", "g", "fenêtre", "window"], ["Top 3,000", "au", "plaît", "please"]];
const GOLD = [["partent", "they leave"], ["maison", "house"], ["toujours", "always"], ["ensemble", "together"]];

export default function LabLanding({ theme }: { theme: LabTheme }) {
  const navigate = useNavigate();
  const start = () => { trackAll("cta"); navigate("/onboarding"); };

  const Hero = () => {
    if (theme === "glass") {
      return (
        <div className="wrap cin">
          <div style={{ display: "grid", gap: 24 }}>
            <span className="eyebrow">Dual subtitles</span>
            <h1>Tap any word.<br /><em>Save it.</em></h1>
            <p className="lead">Watch films, series and YouTube in the language you're learning. Every word is coloured by what you already know.</p>
            <div className="ctas"><button className="btn" onClick={start}>Start free →</button><Link className="btn2" to="/the-chameleon-method">How it works</Link></div>
          </div>
          <div className="screen card" aria-hidden="true">
            <div className="film" /><div className="lbl">UN CAFÉ PRÈS DE LA SEINE · 12:04</div>
            <div className="subbar" translate="no">
              <div className="l1">{SUBS.map(([w, c], i) => <span key={i} style={{ ["--c" as string]: `var(${c})`, animationDelay: `${i * 0.35}s` }}>{w} </span>)}</div>
              <div className="l2" translate="yes">I would like a black coffee, please</div>
            </div>
            <div className="prog"><i /></div>
          </div>
        </div>
      );
    }
    if (theme === "split") {
      return (
        <section className="wrap splith" style={{ paddingTop: 20 }}>
          <span className="eyebrow blend">Learn from what you watch</span>
          <h1 className="blend">Don't know it.<br />Know it.</h1>
          <div className="travel card" aria-hidden="true" translate="no"><b>maison</b><small>house</small></div>
          <p className="lead blend">Every word you save goes red → orange → green, right inside the shows you love.</p>
          <div className="ctas" style={{ justifyContent: "center" }}><button className="btn" onClick={start}>Start free →</button></div>
        </section>
      );
    }
    return (
      <div className="wrap kin">
        <span className="eyebrow">The Chameleon Method</span>
        <h1>
          <span className="line"><span>Watch it.</span></span>
          <span className="line"><span>Tap it.</span></span>
          <span className="line"><span>Turn it <span className="morph"><b>red</b><b>orange</b><b>green</b><b>gold</b></span></span></span>
        </h1>
        <p className="lead">The language app that colours the shows you already love, until you understand them without subtitles.</p>
        <div className="ctas" style={{ justifyContent: "center" }}><button className="btn" onClick={start}>Start free →</button><Link className="btn2" to="/the-chameleon-method">How it works</Link></div>
        <div className="floor" />
      </div>
    );
  };

  return (
    <div className="ll" data-theme={theme}>
      <Seo title="LinguaScript: learn languages from the shows you love" description="Dual subtitles, tap-to-save words and flashcards that turn green. Learn from Netflix, YouTube and any website." path="/" />
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><defs><linearGradient id="ll-rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34C759" /><stop offset=".7" stopColor="#9CF0B6" /><stop offset="1" stopColor="#FFD54A" /></linearGradient></defs></svg>
      <div className="glow" />
      <header className="wrap nav">
        <Link className={`brand${theme === "split" ? " blend" : ""}`} to="/"><img src="/logo.svg" alt="" />LinguaScript</Link>
        <nav className="navl">
          <Link className="hide" to="/the-chameleon-method">Method</Link>
          <Link className="hide" to="/pricing">Pricing</Link>
          <Link to="/auth">Log in</Link>
          <button className="btn sm" onClick={start}>Start free</button>
        </nav>
      </header>

      <Hero />

      <section className={theme === "split" ? "light" : ""}>
        <div className="wrap">
          <span className="eyebrow">How it works</span>
          <h2 style={{ marginTop: 16 }}>Three steps. <em>Every day.</em></h2>
          <div className="steps">
            <div className="step card"><span className="n">01 · WATCH</span><h3>Pick a show</h3><p>Films, series and YouTube in your language, with dual subtitles.</p><div className="demo" translate="no"><span className="g">Je</span><span className="o">regarde</span><span className="g">la</span><span className="r">mer</span></div></div>
            <div className="step card"><span className="n">02 · TAP</span><h3>Save a word</h3><p>Tap any word you don't know. It becomes a red flashcard instantly.</p><div className="demo" translate="no"><span className="r">mer → sea</span></div></div>
            <div className="step card"><span className="n">03 · TURN IT GREEN</span><h3>Review it</h3><p>Short reviews bring it back until it's yours, then it glows green in every video.</p><div className="demo" translate="no"><span className="g">mer ✓</span></div></div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap two">
          <div style={{ display: "grid", gap: 20 }}>
            <span className="eyebrow">Frequency decks</span>
            <h2><span className="g">Top 50</span> to <span className="o">Top 3,000</span>.</h2>
            <p className="lead">Learn the words people actually say first. 100 words make up half of everything you hear.</p>
            <div className="ctas"><Link className="btn2" to="/frequent-words">See why it works</Link></div>
          </div>
          <div className="fan" aria-hidden="true" translate="no">
            {DECKS.map(([a, c, w, m]) => (
              <div key={a} className="fc card"><span className="k">FRENCH · DECK</span><span className={`big ${c}`}>{a}</span><span className="k" style={{ letterSpacing: ".04em" }}>most common words</span><div className="w">{w}<small translate="yes">{m}</small></div></div>
            ))}
          </div>
        </div>
      </section>

      <section className={theme === "split" ? "light" : ""}>
        <div className="wrap two">
          <div className="covring" aria-hidden="true">
            <svg viewBox="0 0 400 400"><circle className="trk" cx="200" cy="200" r="180" /><circle className="val" cx="200" cy="200" r="180" /></svg>
            <div style={{ textAlign: "center" }}><div className="pct">87%</div><div className="lab">of a film you already understand</div></div>
          </div>
          <div style={{ display: "grid", gap: 20 }}>
            <span className="eyebrow">Comprehensible input</span>
            <h2>Know most of it <em>before you press play.</em></h2>
            <p className="lead">LinguaScript checks every film against your decks, so you pick videos you'll actually understand, and learn the rest.</p>
            <div className="legend"><span><i style={{ background: "var(--g)" }} />known</span><span><i style={{ background: "var(--o)" }} />learning</span><span><i style={{ background: "var(--r)" }} />new</span></div>
          </div>
        </div>
      </section>

      <section className="vault">
        <div className="wrap">
          <span className="eyebrow">Reviews</span>
          <h2 style={{ marginTop: 16 }}>Your <span className="gold-t">gold words</span> are ready.</h2>
          <p className="lead" style={{ marginTop: 16 }}>Words you know turn gold when it's time for a quick check: in the app, on your lock screen and in your videos.</p>
          <div className="gws" translate="no">{GOLD.map(([w, m]) => <div key={w} className="gw"><b>{w}</b><small translate="yes">{m}</small></div>)}</div>
        </div>
      </section>

      <section>
        <div className="wrap final">
          <img src="/logo.svg" alt="" />
          <h2>Learn from what<br />you <span className="g">watch.</span></h2>
          <p className="lead">Free to start. Works on the web, in Chrome and on Android.</p>
          <button className="btn" onClick={start}>Start free →</button>
        </div>
      </section>

      <footer className="wrap foot"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/blog">Blog</Link><Link to="/for-schools">Schools</Link></footer>
    </div>
  );
}
