import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { DECK } from "@/lib/deck-colors";

/**
 * "The Ultimate LinguaScript Hedgehog Giveaway" — 1080x1920 Instagram story.
 *
 * The gag: LinguaScript's mascot is a chameleon, an animal whose entire
 * personality is turning green. The prize is a hedgehog, an animal that
 * cannot. The chameleon tries to camouflage as one anyway and grows spikes.
 *
 * Reuses the real ChameleonMascot and deck colours so the giveaway still
 * looks like the brand.
 */

/** Flat hedgehog in the mascot's visual language — same rounded, chunky shapes. */
const Hedgehog = ({ width = 420 }: { width?: number }) => (
  <svg viewBox="0 0 420 300" style={{ width, height: "auto" }} role="img" aria-label="Hedgehog">
    {/* Spikes */}
    {Array.from({ length: 16 }).map((_, i) => {
      const a = Math.PI * (0.06 + (i / 15) * 0.88);
      const cx = 230 - Math.cos(a) * 132;
      const cy = 190 - Math.sin(a) * 108;
      const tx = 230 - Math.cos(a) * 186;
      const ty = 190 - Math.sin(a) * 152;
      return (
        <path
          key={i}
          d={`M${cx - 15} ${cy + 10} L${tx} ${ty} L${cx + 15} ${cy + 10} Z`}
          fill={i % 2 ? "#6B4A34" : "#8A6248"}
        />
      );
    })}
    {/* Body */}
    <ellipse cx="230" cy="196" rx="140" ry="96" fill="#A9784F" />
    {/* Belly */}
    <ellipse cx="214" cy="228" rx="104" ry="58" fill="#E4C39B" />
    {/* Snout */}
    <path d="M96 208 C 60 208, 40 226, 40 240 C 40 254, 62 264, 96 258 Z" fill="#E4C39B" />
    <circle cx="46" cy="238" r="11" fill="#3A2418" />
    {/* Eye */}
    <circle cx="124" cy="204" r="15" fill="#fff" />
    <circle cx="121" cy="205" r="8" fill="#241A12" />
    <circle cx="124" cy="201" r="3" fill="#fff" />
    {/* Feet */}
    <ellipse cx="180" cy="288" rx="26" ry="13" fill="#8A6248" />
    <ellipse cx="272" cy="288" rx="26" ry="13" fill="#8A6248" />
  </svg>
);

/**
 * Spikes that sprout along the chameleon's back, one at a time.
 *
 * Shares ChameleonMascot's 400x270 viewBox and is absolutely positioned over
 * it, so the spikes track the actual body arc (roughly x 150→285, cresting
 * near y 104) instead of floating above the drawing.
 */
const FakeSpikes = ({ progress }: { progress: number }) => (
  <svg
    viewBox="0 0 400 270"
    style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
  >
    {Array.from({ length: 9 }).map((_, i) => {
      const t = Math.max(0, Math.min(1, progress * 9 - i));
      if (t <= 0) return null;
      const u = i / 8; // 0 → 1 along the back
      const bx = 152 + u * 132;
      // Shallow arc following the body's top edge.
      const by = 132 - Math.sin(Math.PI * (0.18 + u * 0.7)) * 30;
      // Lean outward from the body's centre.
      const lean = (u - 0.5) * 1.5;
      const len = 52 * t;
      const tx = bx + lean * len * 0.7;
      const ty = by - len;
      return (
        <path
          key={i}
          d={`M${bx - 11} ${by + 6} L${tx} ${ty} L${bx + 11} ${by + 6} Z`}
          fill={i % 2 ? "#6B4A34" : "#8A6248"}
        />
      );
    })}
  </svg>
);

export const HedgehogGiveaway = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const pop = (at: number, dur = 22) =>
    spring({ frame: frame - at, fps, config: { damping: 190 }, durationInFrames: dur });

  // The chameleon does its one trick.
  const shift = interpolate(frame, [58, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tier: ChameleonTier = shift > 0.72 ? "green" : shift > 0.34 ? "orange" : "red";

  // …then tries to be a hedgehog.
  const spikes = interpolate(frame, [112, 158], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const punchline = pop(168);
  const cta = pop(206);

  // CTA breathes so it reads as tappable.
  const ctaPulse = 1 + Math.sin(Math.max(0, frame - 214) / 7) * 0.022;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#08080B",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        color: "#fff",
        padding: "110px 76px",
        alignItems: "center",
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          fontSize: 46,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          opacity: interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Lingua<span style={{ color: DECK.green }}>Script</span>
      </div>

      {/* Kicker */}
      <div
        style={{
          marginTop: 60,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "0.34em",
          color: DECK.green,
          opacity: pop(14),
        }}
      >
        GIVEAWAY 🦔
      </div>

      {/* Title */}
      <h1
        style={{
          margin: "22px 0 0",
          fontSize: 96,
          lineHeight: 1.02,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          textAlign: "center",
          transform: `translateY(${(1 - pop(24)) * 34}px)`,
          opacity: pop(24),
        }}
      >
        THE ULTIMATE
        <br />
        <span style={{ color: DECK.green }}>HEDGEHOG</span>
        <br />
        GIVEAWAY
      </h1>

      {/* The animals */}
      <div
        style={{
          marginTop: 78,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 30,
          height: 400,
        }}
      >
        <div style={{ position: "relative", width: 420, opacity: pop(50) }}>
          <ChameleonMascot tier={tier} style={{ width: 420 }} />
          {spikes > 0 && <FakeSpikes progress={spikes} />}
        </div>
        <div
          style={{
            opacity: pop(140),
            transform: `translateY(${(1 - pop(140)) * 60}px)`,
          }}
        >
          <Hedgehog width={400} />
        </div>
      </div>

      {/* Punchline */}
      <p
        style={{
          marginTop: 96,
          fontSize: 40,
          lineHeight: 1.32,
          textAlign: "center",
          color: "rgba(255,255,255,.62)",
          maxWidth: 830,
          opacity: punchline,
          transform: `translateY(${(1 - punchline) * 22}px)`,
        }}
      >
        Our mascot is a chameleon.
        <br />
        We're giving away a{" "}
        <span style={{ color: "#E4C39B", fontWeight: 700 }}>hedgehog</span>.
        <br />
        <span style={{ color: "rgba(255,255,255,.4)", fontSize: 34 }}>
          Nobody here can explain this.
        </span>
      </p>

      {/* CTA */}
      <div
        style={{
          position: "absolute",
          bottom: 132,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: cta,
        }}
      >
        <div
          style={{
            transform: `scale(${cta * ctaPulse})`,
            backgroundColor: DECK.green,
            color: "#08080B",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            padding: "30px 58px",
            borderRadius: 26,
            textAlign: "center",
          }}
        >
          REPLY TO THIS STORY TO ENTER 🦔
        </div>
      </div>

      {/* Fine print */}
      <div
        style={{
          position: "absolute",
          bottom: 74,
          fontSize: 24,
          color: "rgba(255,255,255,.3)",
          opacity: interpolate(frame, [220, 240], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        one (1) hedgehog · winner picked at random
      </div>
    </AbsoluteFill>
  );
};

export default HedgehogGiveaway;
