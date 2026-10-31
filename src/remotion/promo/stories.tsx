import { AbsoluteFill, interpolate, Sequence, spring, useVideoConfig } from "remotion";
import type { ChameleonTier } from "@/components/ChameleonMascot";
import type { Deck, Pack } from "./pack";
import { DECK_HEX, type Format, type Theme } from "./theme";
import {
  Backdrop, Caption, Chameleon, Chip, Cursor, EndCard, FONT, Fonts, Layout, PromoProvider,
  Word, WordCard, WordRun, usePromo, useS, useT,
} from "./ui";

/** Each feature scene runs CORE frames at speed 1; the end card adds END. */
export const CORE = 300;
export const END = 120;
export const FEATURE_DURATION = CORE + END;
export const ALL_HOOK = 75;
export const ALL_SPEED = 1.7;
const coreAt = (speed: number) => Math.ceil(CORE / speed);
export const ALL_DURATION = ALL_HOOK + 4 * coreAt(ALL_SPEED) + END;

// ── Caption track: one caption at a time ──────────────────────────────────────

const Captions = ({ items, size }: { items: { text: string; from: number; to: number }[]; size?: number }) => {
  const t = useT();
  const { format } = usePromo();
  const S = useS();
  const item = items.find((i) => t >= i.from && t < i.to) ?? items[items.length - 1];
  const big = size ?? (format === "landscape" ? 76 : 74);
  return (
    <div style={{ minHeight: (format === "landscape" ? 300 : 180) * S, display: "flex", alignItems: format === "landscape" ? "center" : "flex-start", justifyContent: format === "landscape" ? "flex-start" : "center" }}>
      <Caption key={item.text} text={item.text} at={item.from} size={big} align={format === "landscape" ? "left" : "center"} />
    </div>
  );
};

// ── 1 · Watch: dual subtitles, tap a word, red → orange → green ───────────────

export const WatchCore = () => {
  const t = useT();
  const S = useS();
  const { pack, theme } = usePromo();
  const c = pack.captions;
  const gareState: Deck | undefined = t >= 255 ? "green" : t >= 215 ? "orange" : t >= 175 ? "red" : undefined;
  const tier: ChameleonTier = gareState === "orange" ? "orange" : gareState === "red" ? "red" : "green";
  const { format } = usePromo();
  const sceneShift = Math.sin(t / 50) * 10;
  return (
    <Layout
      caption={<Captions items={[
        { text: c.watchHook, from: 0, to: 85 },
        { text: c.tapAny, from: 85, to: 172 },
        { text: c.savedRed, from: 172, to: 212 },
        { text: c.turnsGreen, from: 212, to: CORE },
      ]} />}
      zoom={{ vertical: 1.08, square: 0.78, landscape: 1 }}
      device={
        <div style={{ position: "relative", width: 920 * S, fontFamily: FONT }}>
          {/* The player — an abstract scene, never real footage */}
          <div style={{ position: "relative", width: 920 * S, height: 518 * S, borderRadius: 28 * S, overflow: "hidden", background: "#101521", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(40% 55% at ${30 + sceneShift / 4}% 35%, #3B5BA9 0%, transparent 70%), radial-gradient(45% 60% at ${75 - sceneShift / 4}% 30%, #C26A3A 0%, transparent 70%), linear-gradient(180deg, #1B2540 0%, #0D1220 100%)` }} />
            <svg viewBox="0 0 920 518" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
              <path d={`M0 330 L80 300 L80 250 L140 250 L140 290 L220 270 L220 210 L300 210 L300 280 L380 260 L380 180 L420 160 L460 180 L460 270 L560 250 L560 200 L640 200 L640 260 L720 240 L720 190 L800 190 L800 270 L920 250 L920 518 L0 518 Z`} fill="#0A0E18" opacity="0.9" />
              <rect x={600 + sceneShift} y="300" width="190" height="34" rx="8" fill="#1F2A44" />
            </svg>
            {/* Dual subtitles */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 30 * S, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 * S }}>
              <div style={{ background: "rgba(0,0,0,0.78)", borderRadius: 12 * S, padding: `${10 * S}px ${26 * S}px`, fontSize: 44 * S, fontWeight: 800, color: "#FFFFFF" }}>
                <WordRun words={pack.subtitle} colourAt={20} stagger={6} light={false} override={{ [pack.tapped.word]: { s: gareState ?? "red", at: gareState ? 175 : 1e9 } }} tapWord={pack.tapped.word} cursorAt={78} tapAt={90} />
              </div>
              <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: 8 * S, padding: `${4 * S}px ${18 * S}px`, fontSize: 26 * S, color: "rgba(255,255,255,0.85)" }}>{pack.subtitleTranslation}</div>
            </div>
            {/* Progress bar */}
            <div style={{ position: "absolute", left: 0, bottom: 0, height: 6 * S, width: `${Math.min(100, (t / CORE) * 100)}%`, background: DECK_HEX.green }} />
          </div>
          {/* The word card pops over the player */}
          <div style={{ position: "absolute", left: 0, right: 0, top: (format === "vertical" ? 545 : 300) * S, display: "flex", justifyContent: "center", zIndex: 5 }}>
            <WordCard word={pack.tapped.word} meaning={pack.tapped.meaning} sentence={pack.subtitle.map((w) => w.t).join(" ").replace(" ?", " ?")} at={96} saveAt={148} closeAt={172} width={600} />
          </div>
          {/* Time skips + the chameleon following the word's colour */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 * S, marginTop: 40 * S, minHeight: 150 * S }}>
            <Chameleon tier={tier} size={210} party={gareState === "green"} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 * S, minWidth: 260 * S }}>
              <Chip text={c.later2d} from={195} to={240} />
              <Chip text={c.later1w} from={240} to={CORE} />
            </div>
          </div>
          <span style={{ display: "none", color: theme.fg }} />
        </div>
      }
    />
  );
};

// ── 2 · Any website: real text in colour, then Rings ─────────────────────────

export const WebCore = () => {
  const t = useT();
  const S = useS();
  const { fps } = useVideoConfig();
  const { pack } = usePromo();
  const c = pack.captions;
  const rings = t >= 196;
  const knob = spring({ frame: t - 196, fps, config: { damping: 14 } });
  return (
    <Layout
      caption={<Captions items={[
        { text: c.webHook, from: 0, to: 60 },
        { text: c.webColour, from: 60, to: 190 },
        { text: c.webRings, from: 190, to: CORE },
      ]} />}
      zoom={{ vertical: 1.08, square: 0.7, landscape: 0.92 }}
      device={
        <div style={{ width: 920 * S, borderRadius: 24 * S, overflow: "hidden", background: "#FFFFFF", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", fontFamily: FONT }}>
          {/* Browser chrome */}
          <div style={{ height: 70 * S, background: "#ECEEF1", display: "flex", alignItems: "center", gap: 12 * S, padding: `0 ${22 * S}px` }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((col) => <span key={col} style={{ width: 16 * S, height: 16 * S, borderRadius: "50%", background: col }} />)}
            <div style={{ flex: 1, height: 40 * S, borderRadius: 999, background: "#FFFFFF", marginLeft: 12 * S, display: "flex", alignItems: "center", padding: `0 ${18 * S}px`, fontSize: 20 * S, color: "#5F6368" }}>🔒&nbsp; {pack.articleTitle.toLowerCase().replace(/[^a-zà-ÿ ]/g, "").trim().replace(/ +/g, "-")}</div>
            {/* The extension's style switch */}
            <div style={{ position: "relative", display: "flex", background: "#08080B", borderRadius: 999, padding: 4 * S, gap: 2 * S, fontSize: 18 * S, fontWeight: 700 }}>
              <span style={{ position: "absolute", top: 4 * S, bottom: 4 * S, left: 4 * S + knob * 104 * S, width: 104 * S, borderRadius: 999, background: "#24242D", border: `${1.5 * S}px solid ${DECK_HEX.green}` }} />
              <span style={{ position: "relative", width: 104 * S, textAlign: "center", padding: `${6 * S}px 0`, color: "#F5F5F7" }}>{c.colour}</span>
              <span style={{ position: "relative", width: 104 * S, textAlign: "center", padding: `${6 * S}px 0`, color: "#F5F5F7" }}>{c.rings}<Cursor at={180} tapAt={192} leaveAt={230} /></span>
            </div>
          </div>
          {/* Article */}
          <div style={{ padding: `${40 * S}px ${48 * S}px ${50 * S}px`, color: "#16171A" }}>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 60 * S, fontWeight: 700, lineHeight: 1.1, marginBottom: 22 * S }}>{pack.articleTitle}</div>
            <div style={{ height: 180 * S, borderRadius: 16 * S, background: "linear-gradient(135deg, #DCE7F5, #F3E2D3)", marginBottom: 26 * S }} />
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 40 * S, lineHeight: 1.6 }}>
              <WordRun words={pack.article} colourAt={66} stagger={7} light mode={rings ? "ring" : "text"} />
            </div>
          </div>
        </div>
      }
    />
  );
};

// ── 3 · Phone bubble: tap → words light up → tap a word → save ────────────────

export const PhoneCore = () => {
  const t = useT();
  const S = useS();
  const { fps } = useVideoConfig();
  const { pack } = usePromo();
  const c = pack.captions;
  const flash = interpolate(t, [80, 84, 96], [0, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pill = spring({ frame: t - 98, fps, config: { damping: 14 } });
  const lit = t >= 96;
  const parapluie = t >= 240;
  return (
    <Layout
      caption={<Captions items={[
        { text: c.phoneHook, from: 0, to: 70 },
        { text: c.tapBubble, from: 70, to: 160 },
        { text: c.tapWord, from: 160, to: CORE },
      ]} />}
      zoom={{ vertical: 1.25, square: 0.72, landscape: 0.92 }}
      device={
        <div style={{ position: "relative", width: 500 * S, height: 1000 * S, borderRadius: 64 * S, background: "#0C0C10", padding: 16 * S, boxSizing: "border-box", boxShadow: "0 30px 90px rgba(0,0,0,0.5)", fontFamily: FONT }}>
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 50 * S, overflow: "hidden", background: "#F2F3F5", display: "flex", flexDirection: "column" }}>
            <div style={{ height: 96 * S, background: "#FFFFFF", borderBottom: "1px solid #E3E5E8", display: "flex", alignItems: "flex-end", gap: 14 * S, padding: `0 ${22 * S}px ${16 * S}px` }}>
              <div style={{ width: 46 * S, height: 46 * S, borderRadius: "50%", background: "#C7D2FE", color: "#3730A3", fontWeight: 800, fontSize: 22 * S, display: "flex", alignItems: "center", justifyContent: "center" }}>L</div>
              <div style={{ fontWeight: 700, fontSize: 24 * S, color: "#16171A" }}>Léa</div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 * S, padding: `${26 * S}px ${20 * S}px` }}>
              {pack.chat.map((m, i) => (
                <div key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "82%", background: m.me ? "#E3EAF8" : "#FFFFFF", borderRadius: m.me ? `${24 * S}px ${24 * S}px ${6 * S}px ${24 * S}px` : `${24 * S}px ${24 * S}px ${24 * S}px ${6 * S}px`, padding: `${12 * S}px ${18 * S}px`, fontSize: 26 * S, lineHeight: 1.45, color: "#16171A" }}>
                  {lit ? (
                    <WordRun words={m.words} colourAt={100 + i * 10} stagger={4} light override={parapluie ? { [pack.chatTapped.word]: { s: "red", at: 240 } } : undefined} tapWord={pack.chatTapped.word} cursorAt={156} tapAt={168} />
                  ) : m.words.map((w) => w.t).join(" ")}
                </div>
              ))}
            </div>
            <div style={{ height: 84 * S, background: "#FFFFFF", borderTop: "1px solid #E3E5E8", display: "flex", alignItems: "center", padding: `0 ${18 * S}px` }}>
              <div style={{ flex: 1, height: 50 * S, borderRadius: 999, border: "1px solid #DADCE0", background: "#F8F9FA" }} />
            </div>
            {/* Screen-capture flash */}
            <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: flash }} />
            {/* "8 words · tap one" pill */}
            {lit && (
              <div style={{ position: "absolute", bottom: 104 * S, left: "50%", transform: `translateX(-50%) scale(${pill})`, background: "#08080B", color: "#F5F5F7", borderRadius: 999, padding: `${10 * S}px ${18 * S}px`, display: "flex", alignItems: "center", gap: 10 * S, fontSize: 18 * S, fontWeight: 700, whiteSpace: "nowrap" }}>
                {(["red", "orange", "green", "gold"] as const).map((k) => <span key={k} style={{ width: 11 * S, height: 11 * S, borderRadius: "50%", background: DECK_HEX[k] }} />)}
                {pack.chat.flatMap((m) => m.words).filter((w) => w.s).length} · {c.tapWord.split(" ").slice(0, 3).join(" ")}
              </div>
            )}
            {/* The 🦎 bubble */}
            <div style={{ position: "absolute", right: 0, top: 560 * S, width: 92 * S, height: 80 * S, borderRadius: `${40 * S}px 0 0 ${40 * S}px`, background: "#08080B", boxShadow: lit ? `0 0 0 ${4 * S}px ${DECK_HEX.green}, 0 8px 20px rgba(0,0,0,0.3)` : "0 8px 20px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 8 * S }}>
              <div style={{ transform: "scale(0.9)" }}><Chameleon tier="green" size={70} /></div>
              <Cursor at={60} tapAt={78} leaveAt={110} />
            </div>
            {/* Word card */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 20 * S, display: "flex", justifyContent: "center" }}>
              <WordCard word={pack.chatTapped.word} meaning={pack.chatTapped.meaning} sentence={pack.chatTapped.sentence} at={176} saveAt={214} closeAt={238} width={440} />
            </div>
          </div>
          <div style={{ position: "absolute", bottom: -70 * S, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <Chip text={c.android} from={10} to={CORE + 200} />
          </div>
        </div>
      }
    />
  );
};

// ── 4 · Gold review: green → gold → review → back to green → the ladder ──────

const LADDER = ["5 min", "1 d", "3 d", "7 d", "14 d", "30 d", "×1.5 ∞"];

export const GoldCore = () => {
  const t = useT();
  const S = useS();
  const { fps } = useVideoConfig();
  const { pack, theme } = usePromo();
  const c = pack.captions;
  const state: Deck = t >= 165 ? "green" : t >= 72 ? "gold" : "green";
  const flip = interpolate(t, [112, 132], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const back = interpolate(t, [160, 172], [180, 360], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rot = t >= 160 ? back : flip;
  const showBack = rot > 90 && rot < 270;
  return (
    <Layout
      caption={<Captions items={[
        { text: c.goldHook, from: 0, to: 100 },
        { text: c.goldDue, from: 100, to: 172 },
        { text: c.ladder, from: 172, to: CORE },
      ]} size={66} />}
      device={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 50 * S, fontFamily: FONT }}>
          <div style={{ minHeight: 60 * S }}><Chip text={c.later5m} from={36} to={100} /></div>
          {/* The card */}
          <div style={{ perspective: 1600 * S }}>
            <div style={{ position: "relative", width: 760 * S, height: 400 * S, transformStyle: "preserve-3d", transform: `rotateY(${rot}deg)` }}>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: 36 * S, background: theme.light ? "#08080B" : theme.surface, border: `${2 * S}px solid ${theme.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 120 * S, fontWeight: 800, letterSpacing: "-0.03em", visibility: showBack ? "hidden" : "visible" }}>
                <Word w={{ t: pack.gold.word }} state={state} since={state === "gold" ? 72 : 165} light={false} />
              </div>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: 36 * S, background: theme.light ? "#08080B" : theme.surface, border: `${2 * S}px solid ${theme.line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 * S, visibility: showBack ? "visible" : "hidden" }}>
                <div style={{ fontSize: 80 * S, fontWeight: 800, color: "#F5F5F7" }}>{pack.gold.meaning}</div>
                <div style={{ position: "relative", fontSize: 32 * S, fontWeight: 800, color: "#08080B", background: DECK_HEX.green, borderRadius: 20 * S, padding: `${16 * S}px ${44 * S}px` }}>
                  ✓ {c.gotIt}
                  <Cursor at={138} tapAt={152} leaveAt={168} />
                </div>
              </div>
            </div>
          </div>
          {/* The ladder */}
          <div style={{ display: "flex", gap: 22 * S, alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: 960 * S }}>
            {LADDER.map((label, i) => {
              const on = 175 + i * 16;
              const p = spring({ frame: t - on, fps, config: { damping: 12 } });
              const goldNow = t >= on && t < on + 10;
              const col = t < on ? theme.line : goldNow ? DECK_HEX.gold : DECK_HEX.green;
              return (
                <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * S, opacity: 0.35 + 0.65 * Math.min(1, p) }}>
                  <span style={{ width: 48 * S, height: 48 * S, borderRadius: "50%", background: col, transform: `scale(${0.7 + 0.3 * Math.min(1, p)})`, boxShadow: goldNow ? `0 0 ${18 * S}px ${6 * S}px rgba(255,200,60,0.6)` : "none" }} />
                  <span style={{ fontSize: 32 * S, fontWeight: 700, color: theme.fg }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
};

// ── Stories: hook/core + end card ─────────────────────────────────────────────

const CORES = { watch: WatchCore, web: WebCore, phone: PhoneCore, gold: GoldCore } as const;
export type StoryId = keyof typeof CORES | "all";

export interface StoryProps { story: StoryId; theme: Theme; pack: Pack; format: Format }

const Frame = ({ theme, pack, format, speed = 1, children }: { theme: Theme; pack: Pack; format: Format; speed?: number; children: React.ReactNode }) => (
  <PromoProvider value={{ theme, pack, format, speed }}>
    <AbsoluteFill>
      <Fonts />
      <Backdrop />
      {children}
    </AbsoluteFill>
  </PromoProvider>
);

const AllHook = () => {
  const t = useT();
  const S = useS();
  const { fps } = useVideoConfig();
  const { pack, theme } = usePromo();
  const words = pack.captions.allHook;
  const cols = [DECK_HEX.red, DECK_HEX.orange, DECK_HEX.gold, DECK_HEX.green];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 * S, fontFamily: FONT }}>
      {words.map((wd, i) => {
        const p = spring({ frame: t - i * 14, fps, config: { damping: 14, mass: 0.6 } });
        const last = i === words.length - 1;
        return (
          <div key={wd} style={{ fontSize: (last ? 110 : 130) * S, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: last ? cols[3] : theme.fg, opacity: p, transform: `translateY(${(1 - p) * 40 * S}px)`, textTransform: theme.captionCase, textAlign: "center" }}>
            {last ? wd : <><span style={{ color: cols[i] }}>●</span> {wd}</>}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const PromoStory = ({ story, theme, pack, format }: StoryProps) => {
  if (story === "all") {
    const seg = coreAt(ALL_SPEED);
    const order = [WatchCore, WebCore, PhoneCore, GoldCore];
    return (
      <Frame theme={theme} pack={pack} format={format}>
        <Sequence durationInFrames={ALL_HOOK}><Frame theme={theme} pack={pack} format={format}><AllHook /></Frame></Sequence>
        {order.map((Core, i) => (
          <Sequence key={i} from={ALL_HOOK + i * seg} durationInFrames={seg}>
            <Frame theme={theme} pack={pack} format={format} speed={ALL_SPEED}><Core /></Frame>
          </Sequence>
        ))}
        <Sequence from={ALL_HOOK + 4 * seg}><Frame theme={theme} pack={pack} format={format}><EndCard /></Frame></Sequence>
      </Frame>
    );
  }
  const Core = CORES[story];
  return (
    <Frame theme={theme} pack={pack} format={format}>
      <Sequence durationInFrames={CORE}><Core /></Sequence>
      <Sequence from={CORE}><EndCard /></Sequence>
    </Frame>
  );
};
