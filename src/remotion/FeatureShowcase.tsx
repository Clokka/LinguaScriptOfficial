// The hand-timed proof-of-concept reel — validates the concept (real UI,
// real colours, a full save -> review -> level-up loop) before any of it is
// automated. Every beat reuses real product pieces (ChameleonMascot,
// WordBlock, DECK colours) rather than recreating them, the same principle
// GreenTransition.tsx already established.
//
// One sentence carries the whole reel: "J'ai acheté un short pour la
// plage." / target word "short" — a plain noun with an unambiguous French
// translation, easy to follow at a glance in a social clip.
import { AbsoluteFill, Series, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DECK } from "@/lib/deck-colors";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { WordBlock } from "@/components/blocks/WordBlock";

const FPS = 30;
const WORDS = ["J'ai", "acheté", "un", "short", "pour", "la", "plage."];
const TARGET_INDEX = 3;
const TRANSLATION = "I bought shorts for the beach.";
// 7 words at this width total 1015px, fitting inside the 1080-wide vertical
// frame with margin either side — CELL_WIDTH=190 (1330px total) ran the row
// off both edges.
const CELL_WIDTH = 145;
const WORD_FONT_SIZE = 42;
const ROW_Y = 640;

function wordCenterX(index: number, count: number, width: number) {
  const rowWidth = count * CELL_WIDTH;
  const startX = width / 2 - rowWidth / 2;
  return startX + index * CELL_WIDTH + CELL_WIDTH / 2;
}

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** A little rounded cursor with a click-ripple, positioned in absolute px. */
function Cursor({ x, y, clicking }: { x: number; y: number; clicking: boolean }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}>
      {clicking && (
        <div
          style={{
            position: "absolute",
            inset: -28,
            borderRadius: "50%",
            border: `3px solid ${DECK.green}`,
            opacity: 0,
            animation: undefined,
          }}
        />
      )}
      <svg width="40" height="40" viewBox="0 0 24 24" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))" }}>
        <path d="M4 2 L4 20 L9 15.5 L12.5 22 L15 20.5 L11.5 14 L18 14 Z" fill="#fff" stroke="#000" strokeWidth="1" />
      </svg>
    </div>
  );
}

/** Beat 1: the subtitle line, cursor arriving on "short", holding, clicking. */
function SubtitleClickBeat() {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const lineIn = spring({ frame, fps: FPS, config: { damping: 200 }, durationInFrames: 20 });
  const targetX = wordCenterX(TARGET_INDEX, WORDS.length, width);
  const startX = wordCenterX(0, WORDS.length, width) - 260;

  // Cursor travels in over frames 20-50, holds >=1s on the word (50-90), clicks at 90.
  const cursorX = interpolate(frame, [20, 55], [startX, targetX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const clicking = frame >= 88 && frame < 110;
  const clickPulse = interpolate(frame, [88, 96, 110], [1, 1.25, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#08080B" }}>
      <div
        style={{
          position: "absolute",
          top: ROW_Y - 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: lineIn,
          fontFamily: FONT,
        }}
      >
        <div style={{ display: "inline-flex" }}>
          {WORDS.map((w, i) => (
            <span
              key={i}
              style={{
                width: CELL_WIDTH,
                textAlign: "center",
                fontSize: WORD_FONT_SIZE,
                fontWeight: 800,
                color: i === TARGET_INDEX ? DECK.red : "#fff",
                transform: i === TARGET_INDEX ? `scale(${clickPulse})` : undefined,
              }}
            >
              {w}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 26, fontSize: 26, color: "rgba(255,255,255,.4)" }}>{TRANSLATION}</div>
      </div>

      <Cursor x={cursorX} y={ROW_Y - 60 + 20} clicking={clicking} />

      {frame >= 100 && (
        <div
          style={{
            position: "absolute",
            left: targetX,
            top: ROW_Y - 130,
            transform: "translateX(-50%)",
            opacity: interpolate(frame, [100, 112, 150, 170], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            background: DECK.green,
            color: "#000",
            fontWeight: 800,
            fontSize: 22,
            padding: "10px 20px",
            borderRadius: 999,
            fontFamily: FONT,
            whiteSpace: "nowrap",
          }}
        >
          + Added to Flashcards
        </div>
      )}
    </AbsoluteFill>
  );
}

/** Beat 2: the word ramps red -> orange -> green across two "replays". */
function ColorRampBeat() {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const progress = interpolate(frame, [10, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tier: ChameleonTier = progress > 0.85 ? "green" : progress > 0.4 ? "orange" : "red";
  const wordColour = interpolateColors(frame, [10, 75, 140], [DECK.red, DECK.orange, DECK.green]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#08080B", fontFamily: FONT }}>
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center" }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: DECK.green,
            marginBottom: 22,
          }}
        >
          Reviewed again
        </div>
        <div style={{ display: "inline-flex" }}>
          {WORDS.map((w, i) => (
            <span
              key={i}
              style={{
                width: CELL_WIDTH,
                textAlign: "center",
                fontSize: WORD_FONT_SIZE,
                fontWeight: 800,
                color: i === TARGET_INDEX ? wordColour : "rgba(255,255,255,.55)",
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", top: 900, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <ChameleonMascot tier={tier} style={{ width: 260 }} />
      </div>
      <div style={{ position: "absolute", top: 1220, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 24 }}>
        Every review moves the word closer to green.
      </div>
    </AbsoluteFill>
  );
}

/** Beat 3: the whole line goes green — "line complete" gold sweep. */
function LineCompleteBeat() {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bannerIn = spring({ frame: frame - 20, fps: FPS, config: { damping: 200 }, durationInFrames: 20 });

  return (
    <AbsoluteFill style={{ backgroundColor: "#08080B", fontFamily: FONT }}>
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-flex" }}>
          {WORDS.map((w, i) => {
            const delay = i * 4;
            const glow = interpolate(frame, [delay, delay + 14, delay + 28], [0, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  width: CELL_WIDTH,
                  textAlign: "center",
                  fontSize: WORD_FONT_SIZE,
                  fontWeight: 800,
                  color: DECK.green,
                  textShadow: `0 0 ${16 * glow}px rgba(52,199,89,${0.9 * glow})`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 26, fontSize: 26, color: "rgba(255,255,255,.4)" }}>{TRANSLATION}</div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 760,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: bannerIn,
          transform: `translateY(${(1 - bannerIn) * 20}px)`,
        }}
      >
        <span
          style={{
            display: "inline-block",
            background: DECK.green,
            color: "#000",
            fontWeight: 800,
            fontSize: 30,
            padding: "14px 32px",
            borderRadius: 999,
          }}
        >
          Line complete
        </span>
      </div>
    </AbsoluteFill>
  );
}

/** Beat 4: the gap-fill review moment — real WordBlock + ChameleonMascot. */
function GapFillBeat() {
  const frame = useCurrentFrame();
  const options = ["manteau", "chapeau", "short", "pull"];
  const filled = frame > 130;
  const chamTier: ChameleonTier = filled ? "green" : "orange";
  const goldGlow = interpolate(frame, [130, 150, 175], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // A block "lifts" toward the gap and snaps in, purely frame-driven.
  const dragProgress = interpolate(frame, [95, 128], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#08080B", fontFamily: FONT, alignItems: "center", justifyContent: "center" }}>
      <div
        className="pointer-events-none relative mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0b1210]/95 p-10"
        style={{ width: 760, transform: "scale(1.3)" }}
      >
        <div style={{ marginBottom: 4, textAlign: "center", fontSize: 15, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>
          Complete the LinguaScript
        </div>
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
          <ChameleonMascot tier={chamTier} party={filled} style={{ width: 150 }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 12px", fontSize: 34, fontWeight: 800 }}>
          {WORDS.map((w, i) =>
            i === TARGET_INDEX ? (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  minWidth: "5ch",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  padding: "4px 8px",
                  color: filled ? DECK.green : undefined,
                  textShadow: filled ? `0 0 ${16 * goldGlow}px rgba(251,191,36,${goldGlow})` : undefined,
                  border: filled ? undefined : "2px dashed rgba(255,255,255,0.28)",
                  background: filled ? undefined : "rgba(255,255,255,0.04)",
                  minHeight: "1.4em",
                }}
              >
                {filled ? w : " "}
              </span>
            ) : (
              <span key={i} style={{ color: DECK.green }}>
                {w}
              </span>
            ),
          )}
        </div>
        <div style={{ marginTop: 30, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 20 }}>
          <div style={{ marginBottom: 12, textAlign: "center", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,.35)" }}>
            {filled ? "Nice." : "Drag the missing word into the gap"}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, position: "relative", height: 68 }}>
            {options.map((opt) => {
              const isAnswer = opt === "short";
              const lift = isAnswer ? dragProgress : 0;
              return (
                <div
                  key={opt}
                  style={{
                    opacity: filled && isAnswer ? 0.25 : 1,
                    transform: isAnswer ? `translateY(${-lift * 18}px)` : undefined,
                  }}
                >
                  <WordBlock label={opt} skin={filled && isAnswer ? "green" : isAnswer ? "orange" : "slate"} draggable={false} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Beat 5: level-up celebration — the real 2D mascot in "party" mode, gold glow, XP. */
function LevelUpBeat() {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: FPS, config: { damping: 12, mass: 0.6 }, durationInFrames: 24 });
  const glowPulse = 0.6 + 0.4 * Math.sin(frame / 6);
  const captionIn = interpolate(frame, [18, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#08080B", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ position: "relative", width: 420, height: 420, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "absolute",
            inset: "8%",
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(251,191,36,${0.32 * glowPulse}), rgba(251,146,60,${0.14 * glowPulse}) 55%, transparent 72%)`,
          }}
        />
        <div style={{ transform: `scale(${pop})` }}>
          <ChameleonMascot tier="green" party style={{ width: 300 }} />
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 54,
          fontWeight: 800,
          background: "linear-gradient(135deg, #FF8A00, #FBBF24)",
          WebkitBackgroundClip: "text",
          color: "transparent",
          opacity: captionIn,
        }}
      >
        Level 5!
      </div>
      <p style={{ marginTop: 8, fontSize: 24, color: "rgba(255,255,255,.5)", opacity: captionIn }}>Halfway to ten</p>
    </AbsoluteFill>
  );
}

/** Beat 0 / 6: intro and outro cards, matching GreenTransition's branding. */
function BrandCard({ tagline }: { tagline: string }) {
  const frame = useCurrentFrame();
  const in_ = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#08080B", alignItems: "center", justifyContent: "center", fontFamily: FONT, opacity: in_ }}>
      <ChameleonMascot tier="green" style={{ width: 220 }} />
      <div style={{ marginTop: 22, fontSize: 60, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>
        Lingua<span style={{ color: DECK.green }}>Script</span>
      </div>
      <div style={{ marginTop: 14, fontSize: 26, color: "rgba(255,255,255,.45)", textAlign: "center", padding: "0 60px" }}>{tagline}</div>
    </AbsoluteFill>
  );
}

export const FeatureShowcase = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={60}>
        <BrandCard tagline="Save a word. Watch it come alive." />
      </Series.Sequence>
      <Series.Sequence durationInFrames={190}>
        <SubtitleClickBeat />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <ColorRampBeat />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90}>
        <LineCompleteBeat />
      </Series.Sequence>
      <Series.Sequence durationInFrames={210}>
        <GapFillBeat />
      </Series.Sequence>
      <Series.Sequence durationInFrames={130}>
        <LevelUpBeat />
      </Series.Sequence>
      <Series.Sequence durationInFrames={70}>
        <BrandCard tagline="Learn the language you're already watching." />
      </Series.Sequence>
    </Series>
  );
};

export default FeatureShowcase;
