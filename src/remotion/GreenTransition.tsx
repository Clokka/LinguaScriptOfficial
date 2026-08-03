import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { DECK } from "@/lib/deck-colors";

/**
 * "Watch the language turn green" — the launch reel.
 *
 * Reuses the real ChameleonMascot and the canonical deck colours rather than
 * recreating them, so the video cannot drift from the product.
 *
 * Everything is driven from `frame`, never from CSS transitions: Remotion
 * renders discrete frames by seeking, so a CSS transition would not
 * interpolate and would produce non-deterministic output.
 */
const LINE = [
  { fr: "alors,", en: "so," },
  { fr: "quelle", en: "what" },
  { fr: "est", en: "is" },
  { fr: "la", en: "the" },
  { fr: "meilleure", en: "best" },
  { fr: "façon", en: "way" },
];

/** Frames each word takes to travel red → green, and the stagger between them. */
const WORD_RAMP = 22;
const WORD_STAGGER = 14;
const START = 26;

export const GreenTransition = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Overall progress across the whole line, 0 → 1.
  const lineEnd = START + WORD_STAGGER * (LINE.length - 1) + WORD_RAMP;
  const progress = interpolate(frame, [START, lineEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Discrete deck states — the app's model is three decks, not a gradient.
  const tier: ChameleonTier = progress > 0.85 ? "green" : progress > 0.4 ? "orange" : "red";

  const pct = Math.round(interpolate(progress, [0, 1], [46, 97]));

  // Title lifts in on a spring.
  const titleIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 26 });

  // Everything settles, then the end card fades up.
  const outro = interpolate(frame, [durationInFrames - 46, durationInFrames - 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#08080B",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        color: "#fff",
        padding: 96,
        justifyContent: "center",
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          fontSize: 42,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Lingua<span style={{ color: DECK.green }}>Script</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 80, marginTop: 56 }}>
        <div style={{ flex: 1.5 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: DECK.green,
              opacity: titleIn,
              marginBottom: 22,
            }}
          >
            The moment it clicks
          </div>

          <h1
            style={{
              fontSize: 82,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              margin: 0,
              marginBottom: 54,
              transform: `translateY(${(1 - titleIn) * 26}px)`,
              opacity: titleIn,
            }}
          >
            Watch the language
            <br />
            <span style={{ color: DECK.green }}>turn green.</span>
          </h1>

          {/* The line */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0 22px", fontSize: 60, fontWeight: 800 }}>
            {LINE.map((w, i) => {
              const from = START + i * WORD_STAGGER;
              const colour = interpolateColors(
                frame,
                [from, from + WORD_RAMP / 2, from + WORD_RAMP],
                [DECK.red, DECK.orange, DECK.green],
              );
              const lift = interpolate(frame, [from, from + WORD_RAMP], [0, -10], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span key={w.fr} style={{ color: colour, transform: `translateY(${lift}px)` }}>
                  {w.fr}
                </span>
              );
            })}
          </div>

          <div style={{ marginTop: 20, fontSize: 30, color: "rgba(255,255,255,.42)" }}>
            {LINE.map((w) => w.en).join(" ")}
          </div>

          {/* Comprehension */}
          <div style={{ marginTop: 54, display: "flex", alignItems: "baseline", gap: 18 }}>
            <span style={{ fontSize: 96, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {pct}%
            </span>
            <span style={{ fontSize: 26, color: "rgba(255,255,255,.45)" }}>
              of this scene understood
            </span>
          </div>
        </div>

        {/* Felix */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <ChameleonMascot tier={tier} style={{ width: 460 }} />
        </div>
      </div>

      {/* End card */}
      <AbsoluteFill
        style={{
          backgroundColor: "#08080B",
          opacity: outro,
          justifyContent: "center",
          alignItems: "center",
          gap: 26,
        }}
      >
        <ChameleonMascot tier="green" style={{ width: 300 }} />
        <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: "-0.03em" }}>
          Lingua<span style={{ color: DECK.green }}>Script</span>
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,.45)" }}>
          Learn the language you're already watching.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default GreenTransition;
