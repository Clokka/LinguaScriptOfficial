import { AbsoluteFill, Sequence, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";

/**
 * BrandReel — the dark / glass / gold-to-black motion piece (9:16 for TikTok,
 * Reels, Shorts). Five scenes, all driven from `frame` (Remotion renders by
 * seeking, so no CSS transitions):
 *   1 logo intro · 2 "Watch it. Tap it. Turn it ___" with the morphing deck word
 *   3 Liquid-glass film frame, subtitles colouring in, +20 XP toast
 *   4 gold to black: "Your gold words are ready"
 *   5 end card
 * Deck colours match packages/core (red → orange → green → gold).
 */
export const BRAND_REEL_DURATION = 570;

const C = { bg: "#050607", fg: "#F4F6F5", mut: "rgba(244,246,245,.62)", red: "#FF3B30", orange: "#FF8A00", green: "#34C759", gold: "#FFD54A" };
const FONT = "Inter, 'Inter Display', system-ui, sans-serif";
const ease = Easing.bezier(0.22, 1, 0.36, 1);

const Logo = ({ size = 240 }: { size?: number }) => (
  <svg viewBox="14 76 372 184" width={size} height={size * 0.495} aria-hidden>
    <path d="M20 236 Q200 222 380 240 L380 254 Q200 236 20 250 Z" fill="#5b4332" />
    <path d="M272 176 C322 168 348 190 344 214 C340 236 316 242 304 230 C295 220 302 206 314 207" fill="none" stroke="#26A047" strokeWidth="15" strokeLinecap="round" />
    <rect x="233" y="196" width="15" height="38" rx="7.5" fill="#26A047" />
    <path d="M136 196 Q128 118 205 106 Q276 96 285 160 Q290 202 244 208 L164 210 Q140 208 136 196 Z" fill="#34C759" />
    <path d="M158 130 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 l-2 10 q-49 -10 -94 2 Z" fill="#1B7A35" />
    <path d="M150 196 Q152 168 178 166 Q166 190 190 206 L164 208 Q152 206 150 196 Z" fill="#B8EFC8" />
    <rect x="182" y="198" width="15" height="40" rx="7.5" fill="#26A047" />
    <circle cx="189.5" cy="238" r="9" fill="#26A047" />
    <path d="M162 118 Q160 92 134 88 Q104 84 88 112 Q74 138 84 162 Q94 186 126 188 Q152 189 160 168 Q166 148 162 118 Z" fill="#34C759" />
    <path d="M82 148 Q104 162 128 154" fill="none" stroke="#3d2b1f" strokeWidth="4.5" strokeLinecap="round" />
    <circle cx="118" cy="126" r="21" fill="#B8EFC8" />
    <circle cx="118" cy="126" r="11.5" fill="#fffef9" />
    <circle cx="122.27" cy="124.58" r="5.5" fill="#241a12" />
    <circle cx="124.77" cy="122.08" r="2" fill="#ffffff" opacity="0.9" />
  </svg>
);

/** Slow drifting colour glows behind everything. */
const Glow = ({ colors }: { colors: string[] }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {colors.map((c, i) => {
        const x = 50 + Math.sin(f / 70 + i * 2) * 28;
        const y = 30 + i * 28 + Math.cos(f / 85 + i) * 10;
        return <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 900, height: 900, marginLeft: -450, marginTop: -450, borderRadius: "50%", background: c, filter: "blur(160px)", opacity: 0.55 }} />;
      })}
    </AbsoluteFill>
  );
};

const fadeOut = (f: number, end: number, len = 12) => interpolate(f, [end - len, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// ---------- 1 · logo intro ----------
const Intro = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 12, mass: 0.8 } });
  const word = interpolate(f, [18, 38], [0, 1], { extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", opacity: fadeOut(f, 75) }}>
      <Glow colors={["rgba(52,199,89,.45)"]} />
      <div style={{ transform: `scale(${0.6 + s * 0.4})`, opacity: s }}><Logo size={420} /></div>
      <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 800, fontSize: 92, letterSpacing: "-0.04em", color: C.fg, opacity: word, transform: `translateY(${(1 - word) * 30}px)` }}>LinguaScript</div>
    </AbsoluteFill>
  );
};

// ---------- 2 · kinetic headline + morphing deck word ----------
const DECKS = [
  { w: "red", c: C.red, r: "999px" },
  { w: "orange", c: C.orange, r: "40px 120px 40px 120px" },
  { w: "green", c: C.green, r: "36px" },
  { w: "gold", c: C.gold, r: "120px 40px 120px 40px" },
];
const Kinetic = () => {
  const f = useCurrentFrame();
  const line = (i: number) => {
    const p = interpolate(f, [i * 8, i * 8 + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
    return { transform: `translateY(${(1 - p) * 110}%)`, display: "inline-block" };
  };
  // pill cycles every 30 frames from frame 36
  const t = Math.max(0, f - 36);
  const idx = Math.min(3, Math.floor(t / 30));
  const local = (t % 30) / 30;
  const from = DECKS[Math.max(0, idx - (local < 0.3 && idx > 0 ? 1 : 0))];
  const mix = idx === 0 ? 1 : interpolate(local, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const prev = DECKS[Math.max(0, idx - 1)];
  const color = interpolateColors(mix, [0, 1], [prev.c, DECKS[idx].c]);
  const pillIn = interpolate(f, [24, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const swap = interpolate(local, [0, 0.2], [0.6, 1], { extrapolateRight: "clamp" });
  void from;
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", opacity: fadeOut(f, 180) }}>
      <Glow colors={["rgba(52,199,89,.25)", "rgba(123,97,255,.25)"]} />
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 150, lineHeight: 1.02, letterSpacing: "-0.05em", color: C.fg, textAlign: "center" }}>
        <div style={{ overflow: "hidden" }}><span style={line(0)}>Watch it.</span></div>
        <div style={{ overflow: "hidden" }}><span style={line(1)}>Tap it.</span></div>
        <div style={{ overflow: "hidden" }}><span style={line(2)}>Turn it</span></div>
        <div style={{ marginTop: 20, display: "inline-block", padding: "6px 54px 18px", borderRadius: DECKS[idx].r, background: `${color}33`, color, opacity: pillIn, transform: `scale(${pillIn * swap})`, boxShadow: idx === 3 ? `0 0 90px ${C.gold}66` : "none", transition: "none" }}>
          {DECKS[idx].w}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3 · glass film + subtitles ----------
const LINE = [
  ["Je", C.green], ["voudrais", C.orange], ["un", C.green], ["café", C.green], ["noir,", C.red], ["s'il", C.green], ["vous", C.green], ["plaît", C.gold],
] as const;
const Film = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16 } });
  const toast = spring({ frame: f - 70, fps, config: { damping: 10, mass: 0.7 } });
  const toastOut = interpolate(f, [100, 112], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", opacity: fadeOut(f, 120) }}>
      <Glow colors={["rgba(52,199,89,.45)", "rgba(123,97,255,.45)", "rgba(255,138,0,.35)"]} />
      <div style={{ position: "absolute", top: 230, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 30, letterSpacing: ".22em", color: C.gold }}>DUAL SUBTITLES</div>
      <div style={{ position: "absolute", top: 290, fontFamily: FONT, fontWeight: 800, fontSize: 96, letterSpacing: "-0.04em", color: C.fg, textAlign: "center", lineHeight: 1 }}>Tap any word.</div>
      <div style={{ width: 960, height: 1100, borderRadius: 64, overflow: "hidden", position: "relative", transform: `translateY(${(1 - enter) * 200}px) scale(${0.92 + enter * 0.08})`, opacity: enter, marginTop: 200,
        background: `radial-gradient(60% 50% at ${40 + Math.sin(f / 30) * 10}% 40%, rgba(255,138,0,.45), transparent 70%), radial-gradient(50% 50% at 70% 65%, rgba(52,199,89,.4), transparent 70%), linear-gradient(#151a2b,#07080d)`,
        boxShadow: "0 60px 120px rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.12)" }}>
        <div style={{ position: "absolute", left: 40, top: 36, fontFamily: "'JetBrains Mono', monospace", fontSize: 24, letterSpacing: ".2em", color: "rgba(255,255,255,.6)" }}>UN CAFÉ PRÈS DE LA SEINE · 12:04</div>
        {/* liquid glass subtitle bar */}
        <div style={{ position: "absolute", left: 40, right: 40, bottom: 120, padding: "34px 30px", borderRadius: 44, textAlign: "center",
          background: "linear-gradient(135deg,rgba(255,255,255,.24),rgba(255,255,255,.06))", border: "1px solid rgba(255,255,255,.45)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,.8), 0 20px 50px rgba(0,0,0,.35)", backdropFilter: "blur(8px) saturate(180%)" }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 46, lineHeight: 1.25, color: "#fff" }}>
            {LINE.map(([w, c], i) => {
              const p = interpolate(f, [16 + i * 6, 26 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return <span key={i} style={{ color: interpolateColors(p, [0, 1], ["#ffffff", c]), marginRight: 16, display: "inline-block", transform: `translateY(${(1 - p) * -6}px)` }}>{w}</span>;
            })}
          </div>
          <div style={{ marginTop: 10, fontFamily: FONT, fontSize: 32, color: "rgba(255,255,255,.75)" }}>I would like a black coffee, please</div>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, bottom: 56, height: 8, borderRadius: 8, background: "rgba(255,255,255,.15)" }}>
          <div style={{ height: "100%", borderRadius: 8, width: `${interpolate(f, [0, 120], [10, 70])}%`, background: C.red }} />
        </div>
        {/* +20 XP toast */}
        <div style={{ position: "absolute", left: "50%", top: 120, transform: `translate(-50%, ${(1 - toast) * -220}px) scale(${0.7 + toast * 0.3})`, opacity: toastOut,
          padding: "22px 40px", borderRadius: 999, fontFamily: FONT, fontWeight: 800, fontSize: 44, color: "#fff",
          background: "linear-gradient(135deg,rgba(255,255,255,.3),rgba(255,255,255,.08))", border: "1px solid rgba(255,255,255,.5)", boxShadow: "inset 0 2px 0 rgba(255,255,255,.8), 0 20px 40px rgba(0,0,0,.35)", whiteSpace: "nowrap" }}>
          <span style={{ color: C.red }}>●</span> noir saved · +20 XP
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 4 · gold to black ----------
const GOLD = [["partent", "they leave"], ["maison", "house"], ["toujours", "always"], ["ensemble", "together"]];
const Gold = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = interpolate(f, [0, 40], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const shine = interpolate(f, [0, 105], [-120, 220]);
  return (
    <AbsoluteFill style={{ background: "#050505", opacity: fadeOut(f, 105) }}>
      <AbsoluteFill style={{ background: `radial-gradient(80% 45% at 50% ${120 - rise * 25}%, rgba(255,213,74,.55), rgba(176,122,0,.22) 45%, transparent 75%)` }} />
      <div style={{ position: "absolute", top: 300, left: 80, right: 80, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 30, letterSpacing: ".22em", color: C.gold }}>REVIEWS</div>
      <div style={{ position: "absolute", top: 360, left: 80, right: 80, fontFamily: FONT, fontWeight: 800, fontSize: 124, lineHeight: 1, letterSpacing: "-0.045em", color: "#F7F3E8" }}>
        Your{" "}
        <span style={{ backgroundImage: `linear-gradient(100deg,#FFD54A 0%,#FFF3C4 ${Math.max(0, shine - 20)}%,#FFD54A ${Math.max(1, shine)}%,#B07A00 ${Math.max(2, shine + 40)}%)`, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", display: "inline-block" }}>gold words</span>
        <br />are ready.
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 260, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {GOLD.map(([w, m], i) => {
          const s = spring({ frame: f - 14 - i * 7, fps, config: { damping: 13 } });
          const bob = Math.sin((f + i * 20) / 18) * 8;
          return (
            <div key={w} style={{ padding: "34px 38px", borderRadius: 40, background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,213,74,.5)", boxShadow: "inset 0 1px 0 rgba(255,213,74,.25), 0 30px 60px rgba(0,0,0,.4)",
              transform: `translateY(${(1 - s) * 160 + bob}px)`, opacity: s }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 64, color: C.gold, textShadow: "0 0 30px rgba(255,213,74,.45)" }}>{w}</div>
              <div style={{ fontFamily: FONT, fontSize: 34, color: "rgba(255,243,196,.75)" }}>{m}</div>
            </div>
          );
        })}
      </div>
      {[[180, 820], [880, 760], [520, 980], [960, 1080], [120, 1180]].map(([x, y], i) => {
        const o = (Math.sin((f + i * 17) / 9) + 1) / 2;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 12, height: 12, borderRadius: 12, background: C.gold, boxShadow: `0 0 24px ${C.gold}`, opacity: o }} />;
      })}
    </AbsoluteFill>
  );
};

// ---------- 5 · end card ----------
const End = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14 } });
  const b = spring({ frame: f - 14, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Glow colors={["rgba(52,199,89,.35)", "rgba(255,213,74,.22)"]} />
      <div style={{ transform: `scale(${0.7 + s * 0.3})`, opacity: s }}><Logo size={360} /></div>
      <div style={{ marginTop: 50, fontFamily: FONT, fontWeight: 800, fontSize: 104, lineHeight: 1.02, letterSpacing: "-0.045em", color: C.fg, opacity: s }}>
        Learn from<br />what you <span style={{ color: C.green }}>watch.</span>
      </div>
      <div style={{ marginTop: 60, padding: "30px 60px", borderRadius: 999, background: C.green, color: "#03110A", fontFamily: FONT, fontWeight: 800, fontSize: 48, transform: `scale(${b})` }}>Start free</div>
      <div style={{ marginTop: 34, fontFamily: FONT, fontWeight: 600, fontSize: 40, color: C.mut, opacity: b }}>linguascript.co.uk</div>
    </AbsoluteFill>
  );
};

export const BrandReel = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Sequence from={0} durationInFrames={75}><Intro /></Sequence>
    <Sequence from={75} durationInFrames={180}><Kinetic /></Sequence>
    <Sequence from={255} durationInFrames={120}><Film /></Sequence>
    <Sequence from={375} durationInFrames={105}><Gold /></Sequence>
    <Sequence from={480} durationInFrames={90}><End /></Sequence>
  </AbsoluteFill>
);
