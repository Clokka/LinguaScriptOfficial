import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import type { Deck, Pack, W } from "./pack";
import { BRAND, DECK_DEEP, DECK_HEX, type Format, type Theme } from "./theme";

// ── Context: style, language pack, format, and playback speed ─────────────────

export interface Promo { theme: Theme; pack: Pack; format: Format; speed: number }
const Ctx = createContext<Promo | null>(null);
export const PromoProvider = ({ value, children }: { value: Promo; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const usePromo = () => useContext(Ctx)!;

/** Scene time in frames — sped up inside the all-in-one video. */
export const useT = () => {
  const f = useCurrentFrame();
  const { speed } = usePromo();
  return f * speed;
};

/** 1 unit = 1px on a 1080-wide short side. */
export const useS = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

export const FONT = "'LS Inter', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const Fonts = () => (
  <style>{`
    @font-face { font-family:'LS Inter'; font-weight:100 900; src:url('${staticFile("fonts/inter-latin-wght-normal.woff2")}') format('woff2'); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+FEFF,U+FFFD; }
    @font-face { font-family:'LS Inter'; font-weight:100 900; src:url('${staticFile("fonts/inter-latin-ext-wght-normal.woff2")}') format('woff2'); unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,U+20AD-20C0,U+2C60-2C7F,U+A720-A7FF; }
  `}</style>
);

// ── Background ────────────────────────────────────────────────────────────────

export const Backdrop = () => {
  const { theme } = usePromo();
  const f = useCurrentFrame();
  const drift = Math.sin(f / 90) * 6;
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 45% at ${50 + drift}% 55%, ${theme.glow}, transparent 70%)` }} />
      {theme.id === "jungle" && (
        <AbsoluteFill style={{ background: `radial-gradient(40% 30% at 10% 10%, rgba(123,191,39,0.12), transparent 70%), radial-gradient(35% 30% at 90% 92%, rgba(52,199,89,0.14), transparent 70%)` }} />
      )}
    </AbsoluteFill>
  );
};

// ── Captions: words rise in one by one ────────────────────────────────────────

export const Caption = ({ text, at = 0, size = 72, align = "center", out }: { text: string; at?: number; size?: number; align?: "center" | "left"; out?: number }) => {
  const { theme } = usePromo();
  const { fps } = useVideoConfig();
  const t = useT();
  const S = useS();
  const words = text.split(" ");
  const fade = out !== undefined ? interpolate(t, [out, out + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <div style={{ fontFamily: FONT, fontSize: size * S, fontWeight: theme.captionWeight, letterSpacing: "-0.02em", lineHeight: 1.08, color: theme.fg, textAlign: align, textTransform: theme.captionCase, opacity: fade }}>
      {words.map((wd, i) => {
        const p = spring({ frame: t - at - i * 3, fps, config: { damping: 18, mass: 0.6 } });
        return (
          <span key={i} style={{ display: "inline-block", marginRight: "0.25em", opacity: p, transform: `translateY(${(1 - p) * 0.4}em)` }}>{wd}</span>
        );
      })}
    </div>
  );
};

// ── A word, in its deck colour (Colour) or with a ring (Rings) ────────────────

export const wordColour = (s: Deck, light: boolean) => (light ? DECK_DEEP[s] : DECK_HEX[s]);

export const Word = ({ w, state, since = 0, mode = "text", light, cursorAt, tapAt, size }: {
  w: W; state?: Deck; since?: number; mode?: "text" | "ring"; light: boolean;
  /** When the cursor should arrive on this word (frames). */ cursorAt?: number;
  /** When the cursor taps it. */ tapAt?: number;
  size?: number;
}) => {
  const t = useT();
  const { fps } = useVideoConfig();
  const S = useS();
  const pop = state ? spring({ frame: t - since, fps, config: { damping: 9, mass: 0.5 } }) : 0;
  const scale = state ? 1 + 0.18 * Math.sin(Math.min(1, pop) * Math.PI) : 1;
  const style: CSSProperties = { display: "inline-block", position: "relative", transform: `scale(${scale})`, transformOrigin: "50% 70%", borderRadius: 10 * S, padding: `0 ${(mode === "ring" && state ? 4 : 0) * S}px`, fontSize: size ? size * S : undefined };
  const shimmer = ((t % 66) / 66) * 300 - 100; // 2.2 s loop
  const glow = 0.5 + 0.5 * Math.sin((t / 66) * Math.PI * 2);

  if (state && mode === "text") {
    if (state === "gold") {
      const base = wordColour("gold", light);
      const shine = light ? "#FFE27A" : "#FFF6C8";
      Object.assign(style, {
        backgroundImage: `linear-gradient(100deg, ${base} 0%, ${base} 35%, ${shine} 50%, ${base} 65%, ${base} 100%)`,
        backgroundSize: "200% 100%", backgroundPosition: `${shimmer}% 0`,
        WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        filter: `drop-shadow(0 0 ${(4 + 8 * glow) * S}px rgba(255,200,60,${light ? 0.45 : 0.7}))`,
      });
    } else {
      style.color = wordColour(state, light);
    }
  }
  if (state && mode === "ring") {
    const c = wordColour(state, light);
    style.boxShadow = state === "gold"
      ? `0 0 0 ${2.5 * S}px ${c}, 0 0 ${(6 + 14 * glow) * S}px ${(2 + 4 * glow) * S}px rgba(255,200,60,0.6)`
      : `0 0 0 ${2.5 * S}px ${c}`;
  }
  return (
    <span style={style}>
      {w.t}
      {cursorAt !== undefined && <Cursor at={cursorAt} tapAt={tapAt} />}
    </span>
  );
};

/** A row of words that wraps; words take their state from the pack, revealed at `colourAt + i*stagger`. */
export const WordRun = ({ words, colourAt, stagger = 4, mode = "text", light, override, tapWord, cursorAt, tapAt, size }: {
  words: W[]; colourAt: number; stagger?: number; mode?: "text" | "ring"; light: boolean;
  override?: Record<string, { s: Deck; at: number }>; tapWord?: string; cursorAt?: number; tapAt?: number; size?: number;
}) => {
  const t = useT();
  let n = 0;
  return (
    <>
      {words.map((w, i) => {
        const o = override?.[w.t];
        let state: Deck | undefined;
        let since = 0;
        if (o && t >= o.at) { state = o.s; since = o.at; }
        else if (w.s) {
          const at = colourAt + n * stagger;
          n++;
          if (t >= at) { state = w.s; since = at; }
        }
        const isTap = tapWord !== undefined && w.t === tapWord;
        return (
          <span key={i}>
            <Word w={w} state={state} since={since} mode={mode} light={light} cursorAt={isTap ? cursorAt : undefined} tapAt={isTap ? tapAt : undefined} size={size} />{" "}
          </span>
        );
      })}
    </>
  );
};

// ── Cursor: flies in to the element it's rendered inside, then taps ───────────

export const Cursor = ({ at, tapAt, leaveAt }: { at: number; tapAt?: number; leaveAt?: number }) => {
  const t = useT();
  const S = useS();
  if (t < at - 24) return null;
  const p = interpolate(t, [at - 24, at], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const leave = leaveAt !== undefined ? interpolate(t, [leaveAt, leaveAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const press = tapAt !== undefined ? interpolate(t, [tapAt, tapAt + 4, tapAt + 9], [1, 0.82, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const ring = tapAt !== undefined ? interpolate(t, [tapAt, tapAt + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const dx = (1 - p) * 260 + leave * 200;
  const dy = (1 - p) * 220 + leave * 160;
  return (
    <span style={{ position: "absolute", left: "55%", top: "60%", width: 0, height: 0, pointerEvents: "none", opacity: 1 - leave, zIndex: 50 }}>
      {tapAt !== undefined && t >= tapAt && (
        <span style={{ position: "absolute", left: -30 * S * ring, top: -30 * S * ring, width: 60 * S * ring, height: 60 * S * ring, borderRadius: "50%", border: `${3 * S}px solid rgba(255,255,255,${0.8 * (1 - ring)})`, boxShadow: `0 0 0 ${2 * S}px rgba(0,0,0,${0.25 * (1 - ring)})` }} />
      )}
      <svg width={44 * S} height={44 * S} viewBox="0 0 24 24" style={{ position: "absolute", left: 0, top: 0, transform: `translate(${dx * S}px, ${dy * S}px) scale(${press})`, transformOrigin: "0 0", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))" }}>
        <path d="M3 2l17 9-7.5 1.8L9 20z" fill="#FFFFFF" stroke="#08080B" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

// ── Word card (the tap-a-word popup) ──────────────────────────────────────────

export const WordCard = ({ word, meaning, sentence, at, saveAt, closeAt, width = 640 }: { word: string; meaning: string; sentence?: string; at: number; saveAt: number; closeAt: number; width?: number }) => {
  const t = useT();
  const { fps } = useVideoConfig();
  const S = useS();
  const { pack } = usePromo();
  if (t < at || t > closeAt + 12) return null;
  const inP = spring({ frame: t - at, fps, config: { damping: 14, mass: 0.6 } });
  const outP = interpolate(t, [closeAt, closeAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const saved = t >= saveAt;
  return (
    <div style={{ width: width * S, boxSizing: "border-box", background: "#08080B", border: `1px solid #24242D`, borderRadius: 28 * S, padding: `${26 * S}px ${30 * S}px`, color: "#F5F5F7", fontFamily: FONT, boxShadow: "0 30px 80px rgba(0,0,0,0.5)", transform: `translateY(${(1 - inP) * 60 * S + outP * 40 * S}px) scale(${0.92 + 0.08 * inP})`, opacity: inP * (1 - outP) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 * S, fontSize: 20 * S, fontWeight: 700 }}>
        {(["red", "orange", "green"] as const).map((c) => <span key={c} style={{ width: 12 * S, height: 12 * S, borderRadius: "50%", background: DECK_HEX[c] }} />)}
        <span style={{ marginLeft: 6 * S }}>Lingua<span style={{ color: DECK_HEX.green }}>Script</span></span>
      </div>
      <div style={{ fontSize: 64 * S, fontWeight: 800, marginTop: 14 * S, letterSpacing: "-0.02em" }}>{word}</div>
      <div style={{ fontSize: 34 * S, fontWeight: 600, marginTop: 2 * S }}>{meaning}</div>
      {sentence && <div style={{ fontSize: 22 * S, color: "#9A9AA6", fontStyle: "italic", marginTop: 10 * S }}>« {sentence} »</div>}
      <div style={{ marginTop: 22 * S, height: 76 * S, borderRadius: 20 * S, border: `${3 * S}px solid ${DECK_HEX.red}`, background: saved ? DECK_HEX.red : "rgba(255,59,48,0.15)", color: saved ? "#08080B" : DECK_HEX.red, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 * S, fontSize: 30 * S, fontWeight: 800, position: "relative" }}>
        {saved ? `✓ ${pack.captions.saved}` : <><span style={{ width: 16 * S, height: 16 * S, borderRadius: "50%", background: DECK_HEX.red }} />{pack.captions.save}</>}
        <Cursor at={saveAt - 6} tapAt={saveAt} leaveAt={closeAt - 4} />
      </div>
    </div>
  );
};

// ── The chameleon ─────────────────────────────────────────────────────────────

export const Chameleon = ({ tier, size = 220, party = false }: { tier: ChameleonTier; size?: number; party?: boolean }) => {
  const S = useS();
  return <ChameleonMascot tier={tier} party={party} style={{ width: size * S, height: size * S * 0.62 }} />;
};

// ── End card ──────────────────────────────────────────────────────────────────

export const EndCard = ({ at = 0 }: { at?: number }) => {
  const t = useT();
  const { fps } = useVideoConfig();
  const S = useS();
  const { theme, pack } = usePromo();
  const p = spring({ frame: t - at, fps, config: { damping: 16 } });
  const tierAt = (k: number) => (t - at > k);
  const tier: ChameleonTier = tierAt(40) ? "green" : tierAt(22) ? "orange" : "red";
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 26 * S, fontFamily: FONT, opacity: p }}>
      <div style={{ transform: `scale(${0.8 + 0.2 * p})` }}><Chameleon tier={tier} size={360} party={tierAt(40)} /></div>
      <div style={{ fontSize: 96 * S, fontWeight: 800, letterSpacing: "-0.03em", color: theme.fg }}>
        Lingua<span style={{ color: theme.light ? "#1E8E3E" : DECK_HEX.green }}>Script</span>
      </div>
      <div style={{ fontSize: 40 * S, fontWeight: 600, color: theme.muted }}>{pack.captions.tagline}</div>
      <div style={{ display: "flex", gap: 16 * S, marginTop: 10 * S }}>
        <span style={{ fontSize: 32 * S, fontWeight: 800, color: "#08080B", background: BRAND.green, borderRadius: 999, padding: `${16 * S}px ${34 * S}px` }}>{pack.captions.cta}</span>
        <span style={{ fontSize: 32 * S, fontWeight: 700, color: theme.fg, border: `${2 * S}px solid ${theme.line}`, borderRadius: 999, padding: `${16 * S}px ${30 * S}px` }}>{pack.captions.free}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── Layout: caption + device, stacked (vertical/square) or side by side ───────

export const Layout = ({ caption, device, zoom }: { caption: ReactNode; device: ReactNode; zoom?: Partial<Record<Format, number>> }) => {
  const { format } = usePromo();
  const S = useS();
  if (format === "landscape") {
    return (
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: `0 ${90 * S}px`, gap: 70 * S }}>
        <div style={{ flex: "0 0 38%" }}>{caption}</div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", zoom: zoom?.landscape ?? 1 } as CSSProperties}>{device}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: format === "vertical" ? `${120 * S}px ${60 * S}px` : `${40 * S}px ${60 * S}px`, gap: (format === "vertical" ? 80 : 30) * S }}>
      <div style={{ width: "100%" }}>{caption}</div>
      <div style={{ display: "flex", justifyContent: "center", zoom: zoom?.[format] ?? (format === "square" ? 0.82 : 1) } as CSSProperties}>{device}</div>
    </AbsoluteFill>
  );
};

/** Small time-skip chip ("2 days later"). */
export const Chip = ({ text, from, to }: { text: string; from: number; to: number }) => {
  const t = useT();
  const S = useS();
  const { theme } = usePromo();
  const o = interpolate(t, [from, from + 8, to - 8, to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (o <= 0) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 * S, fontFamily: FONT, fontSize: 28 * S, fontWeight: 700, color: theme.fg, background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 999, padding: `${10 * S}px ${22 * S}px`, opacity: o }}>
      <svg width={24 * S} height={24 * S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      {text}
    </span>
  );
};
