import {
  AbsoluteFill,
  Sequence,
  Audio,
  Img,
  OffthreadVideo,
  staticFile,
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { DECK } from "@/lib/deck-colors";

/**
 * "Watch. Learn. Understand." — the Chrome extension launch reel.
 *
 * Every scene reuses the real brand primitives (ChameleonMascot, DECK) the
 * same way GreenTransition/HedgehogGiveaway already do, rather than
 * recreating the brand from stock assets. Scenes are composed with
 * <Sequence> so each one gets its own local frame 0 — no scene's animation
 * math depends on the total video length.
 *
 * Multi-language: the whole reel is parameterized by `lang` (see CONTENT
 * below) so the same timeline/animation code produces a French, Spanish, or
 * Japanese cut just by swapping the on-screen sentence and platform names —
 * see Root.tsx for the three registered compositions.
 *
 * Platform badges: Netflix and Crunchyroll use their real logo marks
 * (public/brand-logos/*.png, background chroma-keyed out) purely
 * referentially — "this runs on top of Netflix" — the same way any browser
 * extension's marketing shows the sites it works with, not to imply a
 * partnership with either company. YouTube has no logo file supplied yet,
 * so it still falls back to a plain text wordmark (see LangContent.logo).
 * Video content is a separate, higher-risk decision: DeviceMockup can render
 * a real clip via `videoSrc` (a local file in public/, e.g.
 * "video/fr-hero.mp4"), but no clip is wired in — dropping in real footage
 * (especially a copyrighted film/show clip) is a rights decision for
 * whoever owns that footage, not something to source here.
 *
 * Narration: each scene accepts an optional `audioSrc`. Files are generated
 * by `npm run voiceover` (scripts/generate-voiceover.ts, ElevenLabs) into
 * public/audio/launch-reel/. Until those exist, scenes simply render silent —
 * nothing here throws on a missing file, so this always previews/renders.
 * The VO script itself is English narration only, for every language cut,
 * until localized narration is requested.
 */

const FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans JP', 'IPAGothic', sans-serif";
const BG = "#08080B";

// ---- Narration script (also the source of truth for scripts/generate-voiceover.ts) ----
export const VO_LINES: { id: string; text: string }[] = [
  { id: "scene2", text: "Turn the content you already love into language learning." },
  { id: "scene3", text: "Learn directly from the videos you already watch." },
  { id: "scene4", text: "Click unfamiliar words for instant translations." },
  { id: "scene5", text: "Save useful vocabulary with one click." },
  { id: "scene6", text: "Then review your words with spaced repetition." },
  { id: "scene7", text: "And as your vocabulary grows, watch the language become easier." },
  { id: "scene8", text: "LinguaScript. Watch the language turn green." },
];

const voFor = (id: string) => `audio/launch-reel/${id}.mp3`;

// Flip once `npm run voiceover` has actually written the mp3s (see
// scripts/generate-voiceover.ts) — a render/preview fails hard on an <Audio>
// pointed at a file that doesn't exist yet, so this stays false until then.
const AUDIO_READY = false;

const NarrationTrack = ({ id }: { id: string }) => {
  if (!AUDIO_READY) return null;
  return <Audio src={staticFile(voFor(id))} />;
};

// ---- Per-language content ----
// One consistent example sentence per language, reused across scenes 1
// (the problem), 4 (click-to-translate) and 7 (the comprehension shift) so
// the reel tells one coherent story rather than three unrelated snippets.
export type Lang = "fr" | "es" | "ja";

interface LangContent {
  label: string;
  /** Two platforms shown in scene 3. `logo` is an actual brand mark (a real
   *  logo file under public/brand-logos/) used referentially — "this runs on
   *  Netflix" — not to imply any partnership; falls back to a plain text
   *  wordmark when no logo file is set. See file header. */
  platforms: { name: string; logo?: string; videoSrc?: string }[];
  /** The running example sentence, tokenized for word-by-word colour/highlight. */
  sentence: string[];
  /** Index into `sentence` that's clicked/saved/reviewed in scenes 4–6. */
  wordIndex: number;
  /** The clicked word as shown in the popup/flashcard (may drop trailing punctuation). */
  word: string;
  translation: string;
  /** Two more flashcards for scene 6's review stack. */
  deck: { front: string; back: string }[];
  /** Optional local video (public/…mp4) behind the subtitle scenes — see file header. */
  videoSrc?: string;
}

const CONTENT: Record<Lang, LangContent> = {
  fr: {
    label: "French",
    platforms: [
      { name: "Netflix", logo: "brand-logos/netflix.png" },
      { name: "YouTube", logo: "brand-logos/youtube.png" },
    ],
    sentence: ["Je", "n'ai", "aucune", "idée,", "mais", "je", "comprends."],
    wordIndex: 3,
    word: "idée",
    translation: "idea / clue",
    deck: [
      { front: "idée", back: "idea / clue" },
      { front: "pressé", back: "in a hurry" },
      { front: "rater", back: "to miss (out)" },
    ],
  },
  es: {
    label: "Spanish",
    platforms: [
      { name: "Netflix", logo: "brand-logos/netflix.png" },
      { name: "YouTube", logo: "brand-logos/youtube.png" },
    ],
    sentence: ["No", "tengo", "ni", "idea,", "pero", "entiendo."],
    wordIndex: 3,
    word: "idea",
    translation: "idea / clue",
    deck: [
      { front: "idea", back: "idea / clue" },
      { front: "apurado", back: "in a hurry" },
      { front: "perderse", back: "to miss (out)" },
    ],
  },
  ja: {
    label: "Japanese",
    // Netflix + YouTube everywhere, not Crunchyroll — the actual extension
    // (extension/adapters/) only has adapters for these two; Crunchyroll was
    // considered for this demographic but isn't a real supported platform,
    // so showing it here would be a false product claim, not just a
    // trademark question.
    platforms: [
      { name: "Netflix", logo: "brand-logos/netflix.png" },
      { name: "YouTube", logo: "brand-logos/youtube.png" },
    ],
    // Japanese doesn't space-segment naturally; these two chunks are a
    // deliberate simplification for a word-by-word highlight animation, not
    // a linguistically precise tokenization.
    sentence: ["全然", "わからない。"],
    wordIndex: 1,
    word: "わからない",
    translation: "don't understand",
    deck: [
      { front: "わからない", back: "don't understand" },
      { front: "急いで", back: "in a hurry" },
      { front: "見逃す", back: "to miss (out)" },
    ],
  },
};

// ---- Scene timing (30fps) ----
const SCENES = {
  problem: { from: 0, dur: 105 },
  intro: { from: 105, dur: 90 },
  platforms: { from: 195, dur: 120 },
  clickWord: { from: 315, dur: 120 },
  save: { from: 435, dur: 90 },
  review: { from: 525, dur: 120 },
  turnGreen: { from: 645, dur: 180 },
  outro: { from: 825, dur: 240 },
};
export const LAUNCH_REEL_DURATION = SCENES.outro.from + SCENES.outro.dur; // 1065 frames = 35.5s @30fps

const pop = (frame: number, fps: number, at: number, dur = 22) =>
  spring({ frame: frame - at, fps, config: { damping: 190 }, durationInFrames: dur });

// ---- Shared chrome ----

/** A rounded laptop-style screen frame — the "device the learner is watching
 *  on", drawn flat/geometric rather than a stock photo of a laptop. Renders
 *  a real clip if `videoSrc` is given (a local file under public/), else a
 *  plain gradient placeholder. */
const DeviceMockup = ({ children, videoSrc }: { children: React.ReactNode; videoSrc?: string }) => (
  <div
    style={{
      width: 1180,
      borderRadius: 28,
      background: "#151519",
      padding: "18px 18px 42px",
      boxShadow: "0 40px 90px rgba(0,0,0,.55)",
    }}
  >
    <div style={{ display: "flex", gap: 8, marginBottom: 14, paddingLeft: 6 }}>
      <div style={{ width: 12, height: 12, borderRadius: 99, background: "#FF3B30" }} />
      <div style={{ width: 12, height: 12, borderRadius: 99, background: "#FF8A00" }} />
      <div style={{ width: 12, height: 12, borderRadius: 99, background: "#34C759" }} />
    </div>
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        aspectRatio: "16/9",
      }}
    >
      {videoSrc ? (
        <OffthreadVideo
          src={staticFile(videoSrc)}
          muted
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #1c2333, #241a2e 60%, #1a1420)",
          }}
        />
      )}
      {children}
    </div>
  </div>
);

/** A subtitle line where each word can be independently coloured/boxed. */
const SubtitleLine = ({
  words,
  colours,
  highlight,
}: {
  words: string[];
  colours: string[];
  highlight?: number[];
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 34,
      display: "flex",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: "0 10px",
      fontSize: 30,
      fontWeight: 700,
      padding: "0 40px",
    }}
  >
    {words.map((w, i) => (
      <span
        key={i}
        style={{
          color: colours[i],
          padding: highlight?.includes(i) ? "2px 8px" : undefined,
          borderRadius: 8,
          background: highlight?.includes(i) ? "rgba(255,255,255,.08)" : undefined,
          outline: highlight?.includes(i) ? `2px solid ${colours[i]}` : undefined,
        }}
      >
        {w}
      </span>
    ))}
  </div>
);

const Kicker = ({ children, opacity }: { children: React.ReactNode; opacity: number }) => (
  <div
    style={{
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: "0.3em",
      textTransform: "uppercase",
      color: DECK.green,
      opacity,
      marginBottom: 20,
    }}
  >
    {children}
  </div>
);

const Headline = ({ children, progress }: { children: React.ReactNode; progress: number }) => (
  <h1
    style={{
      fontSize: 64,
      fontWeight: 800,
      lineHeight: 1.08,
      letterSpacing: "-0.03em",
      margin: 0,
      color: "#fff",
      opacity: progress,
      transform: `translateY(${(1 - progress) * 24}px)`,
      textAlign: "center",
    }}
  >
    {children}
  </h1>
);

// ---- Scene 1: the problem ----
const SceneProblem = ({ content }: { content: LangContent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { sentence, wordIndex } = content;
  const highlight = [wordIndex];
  const kicker = pop(frame, fps, 30);
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
      <DeviceMockup videoSrc={content.videoSrc}>
        <SubtitleLine
          words={sentence}
          colours={sentence.map((_, i) => (highlight.includes(i) ? "#fff" : "rgba(255,255,255,.5)"))}
          highlight={highlight}
        />
      </DeviceMockup>
      <div style={{ marginTop: 46, opacity: kicker, transform: `translateY(${(1 - kicker) * 16}px)` }}>
        <Headline progress={kicker}>Watching in another language?</Headline>
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 2: introduce LinguaScript ----
const SceneIntro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const panelUp = pop(frame, fps, 6, 26);
  const kicker = pop(frame, fps, 20);
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
      <NarrationTrack id="scene2" />
      <DeviceMockup>
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 24 - (1 - panelUp) * 60,
            opacity: panelUp,
            borderRadius: 18,
            background: "rgba(20,20,26,.72)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,.14)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ width: 46 }}>
            <ChameleonMascot tier="green" style={{ width: 46 }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>
            Lingua<span style={{ color: DECK.green }}>Script</span>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 16, color: "rgba(255,255,255,.55)" }}>
            active on this page
          </div>
        </div>
      </DeviceMockup>
      <div style={{ marginTop: 46, opacity: kicker, transform: `translateY(${(1 - kicker) * 16}px)` }}>
        <Headline progress={kicker}>Meet LinguaScript.</Headline>
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 3: platform quick-cut ----
const SceneName = ({
  label,
  logo,
  from,
  dur,
  frame,
  videoSrc,
}: {
  label: string;
  logo?: string;
  from: number;
  dur: number;
  frame: number;
  videoSrc?: string;
}) => {
  const p = interpolate(frame, [from, from + 14, from + dur - 14, from + dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: p,
        transform: `scale(${0.96 + p * 0.04})`,
      }}
    >
      <DeviceMockup videoSrc={videoSrc}>
        {logo ? (
          <Img
            src={staticFile(logo)}
            style={{ position: "absolute", top: 16, left: 20, height: 44, width: "auto" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 20,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "rgba(255,255,255,.72)",
            }}
          >
            {label}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 18,
            borderRadius: 12,
            background: "rgba(20,20,26,.72)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,.14)",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ width: 20 }}>
            <ChameleonMascot tier="green" style={{ width: 20 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>LinguaScript</span>
        </div>
      </DeviceMockup>
    </div>
  );
};

const ScenePlatforms = ({ content }: { content: LangContent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = pop(frame, fps, 8);
  const { platforms } = content;
  const each = Math.floor(SCENES.platforms.dur / platforms.length);
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
      <NarrationTrack id="scene3" />
      {platforms.map((p, i) => (
        <SceneName
          key={p.name}
          label={p.name}
          logo={p.logo}
          from={i * each}
          dur={i === platforms.length - 1 ? SCENES.platforms.dur - each * i : each}
          frame={frame}
          videoSrc={p.videoSrc}
        />
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 96,
          opacity: kicker,
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "0.05em",
          color: "rgba(255,255,255,.7)",
        }}
      >
        {platforms.map((p, i) => (
          <span key={p.name}>
            {i > 0 && <span style={{ color: DECK.green }}> • </span>}
            {p.name}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 4: click a word, translation pops up ----
const SceneClickWord = ({ content }: { content: LangContent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = pop(frame, fps, 8);
  const click = pop(frame, fps, 34, 14);
  const popup = pop(frame, fps, 46, 20);
  const { sentence, wordIndex, word, translation } = content;
  const clickLeftPct = ((wordIndex + 0.5) / sentence.length) * 100;
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
      <NarrationTrack id="scene4" />
      <DeviceMockup videoSrc={content.videoSrc}>
        <SubtitleLine
          words={sentence}
          colours={sentence.map((_, i) => (i === wordIndex ? "#fff" : "rgba(255,255,255,.5)"))}
          highlight={[wordIndex]}
        />
        {/* click ring */}
        <div
          style={{
            position: "absolute",
            left: `${clickLeftPct}%`,
            bottom: 40,
            width: 30,
            height: 30,
            borderRadius: 99,
            border: `2px solid ${DECK.orange}`,
            transform: `translate(-50%, 0) scale(${1 + click * 0.6})`,
            opacity: interpolate(click, [0, 1], [0.9, 0]),
          }}
        />
        {popup > 0 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 92,
              transform: `translate(-50%, ${(1 - popup) * 14}px) scale(${popup})`,
              opacity: popup,
              background: "rgba(20,20,26,.85)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: 16,
              padding: "16px 22px",
              textAlign: "center",
              minWidth: 220,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{word}</div>
            <div style={{ fontSize: 16, color: DECK.green, fontWeight: 700, marginTop: 4 }}>
              {translation}
            </div>
          </div>
        )}
      </DeviceMockup>
      <div style={{ marginTop: 46, opacity: kicker, transform: `translateY(${(1 - kicker) * 16}px)` }}>
        <Headline progress={kicker}>Click any word.</Headline>
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 5: save it ----
const SceneSave = ({ content }: { content: LangContent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = pop(frame, fps, 6);
  const fly = interpolate(frame, [26, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const deckPulse = interpolate(frame, [56, 66, 76], [1, 1.18, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
      <NarrationTrack id="scene5" />
      <DeviceMockup>
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 92,
            transform: `translate(calc(-50% + ${fly * 380}px), ${-fly * 90}px) scale(${1 - fly * 0.5})`,
            opacity: 1 - Math.max(0, fly - 0.6) * 2.4,
            background: "rgba(20,20,26,.9)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,.14)",
            borderRadius: 16,
            padding: "16px 22px",
            textAlign: "center",
            minWidth: 220,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{content.word}</div>
          <div style={{ fontSize: 16, color: DECK.green, fontWeight: 700, margin: "4px 0 12px" }}>
            {content.translation}
          </div>
          <div
            style={{
              display: "inline-block",
              background: DECK.red,
              color: "#08080B",
              fontWeight: 800,
              fontSize: 14,
              padding: "8px 18px",
              borderRadius: 10,
            }}
          >
            + Save
          </div>
        </div>
        {/* deck icon, top right */}
        <div
          style={{
            position: "absolute",
            top: 22,
            right: 22,
            width: 54,
            height: 54,
            borderRadius: 14,
            background: "rgba(20,20,26,.85)",
            border: `2px solid ${DECK.red}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 800,
            color: "#fff",
            transform: `scale(${deckPulse})`,
          }}
        >
          {frame > 58 ? "1" : "0"}
        </div>
      </DeviceMockup>
      <div style={{ marginTop: 46, opacity: kicker, transform: `translateY(${(1 - kicker) * 16}px)` }}>
        <Headline progress={kicker}>Save it.</Headline>
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 6: review ----
const FlashCard = ({ front, back, flip }: { front: string; back: string; flip: number }) => {
  const showBack = flip > 0.5;
  const rotation = interpolate(flip, [0, 0.5, 1], [0, 90, 180]);
  return (
    <div
      style={{
        width: 340,
        height: 200,
        borderRadius: 20,
        background: "rgba(20,20,26,.85)",
        border: `2px solid ${DECK.orange}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 36,
        fontWeight: 800,
        color: "#fff",
        transform: `perspective(900px) rotateY(${rotation}deg) scaleX(${showBack ? -1 : 1})`,
      }}
    >
      {showBack ? back : front}
    </div>
  );
};

const SceneReview = ({ content }: { content: LangContent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = pop(frame, fps, 6);
  const cardIn = pop(frame, fps, 0, 18);
  const cards = content.deck;
  const flip = interpolate(frame, [24, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const idx = Math.min(cards.length - 1, Math.floor(frame / 34));
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
      <NarrationTrack id="scene6" />
      <div style={{ opacity: cardIn, transform: `scale(${cardIn})` }}>
        <FlashCard front={cards[idx].front} back={cards[idx].back} flip={idx === 0 ? flip : ((frame - idx * 34) % 34) / 20} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 30 }}>
        {cards.map((_, i) => (
          <div
            key={i}
            style={{ width: 10, height: 10, borderRadius: 99, background: i <= idx ? DECK.green : "rgba(255,255,255,.2)" }}
          />
        ))}
      </div>
      <div style={{ marginTop: 40, opacity: kicker, transform: `translateY(${(1 - kicker) * 16}px)` }}>
        <Headline progress={kicker}>Review. Remember. Repeat.</Headline>
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 7: the language turns green ----
const WORD_RAMP = 20;
const WORD_STAGGER = 12;
const TURN_START = 20;

const SceneTurnGreen = ({ content }: { content: LangContent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { sentence } = content;
  const lineEnd = TURN_START + WORD_STAGGER * (sentence.length - 1) + WORD_RAMP;
  const progress = interpolate(frame, [TURN_START, lineEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tier: ChameleonTier = progress > 0.85 ? "green" : progress > 0.4 ? "orange" : "red";
  const pct = Math.round(interpolate(progress, [0, 1], [44, 96]));
  const kicker = pop(frame, fps, 0);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
      <NarrationTrack id="scene7" />
      <div style={{ display: "flex", alignItems: "center", gap: 70, width: 1500 }}>
        <div style={{ flex: 1.4 }}>
          <Kicker opacity={kicker}>the comprehension shift</Kicker>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0 16px", fontSize: 48, fontWeight: 800, maxWidth: 620 }}>
            {sentence.map((w, i) => {
              const start = TURN_START + i * WORD_STAGGER;
              const colour = interpolateColors(
                frame,
                [start, start + WORD_RAMP / 2, start + WORD_RAMP],
                [DECK.red, DECK.orange, DECK.green],
              );
              const lift = interpolate(frame, [start, start + WORD_RAMP], [0, -8], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span key={i} style={{ color: colour, transform: `translateY(${lift}px)` }}>
                  {w}
                </span>
              );
            })}
          </div>
          <div style={{ marginTop: 34, display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontSize: 76, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
              {pct}%
            </span>
            <span style={{ fontSize: 22, color: "rgba(255,255,255,.45)" }}>of this scene understood</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <ChameleonMascot tier={tier} style={{ width: 380 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 8: final brand card ----
const SceneOutro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = pop(frame, fps, 0, 22);
  const tagline = pop(frame, fps, 20, 22);
  const badge = pop(frame, fps, 46, 22);
  const chip = pop(frame, fps, 70, 22);
  const breathe = 1 + Math.sin(Math.max(0, frame - 30) / 9) * 0.02;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        justifyContent: "center",
        alignItems: "center",
        gap: 24,
      }}
    >
      <NarrationTrack id="scene8" />
      <div style={{ opacity: mark, transform: `scale(${0.9 + mark * 0.1 * breathe})` }}>
        <ChameleonMascot tier="green" style={{ width: 220 }} />
      </div>
      <div
        style={{
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "#fff",
          opacity: mark,
          transform: `translateY(${(1 - mark) * 20}px)`,
        }}
      >
        Lingua<span style={{ color: DECK.green }}>Script</span>
      </div>
      <div
        style={{
          fontSize: 28,
          color: "rgba(255,255,255,.6)",
          opacity: tagline,
          transform: `translateY(${(1 - tagline) * 14}px)`,
        }}
      >
        Watch. Learn. Understand.
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 20,
          fontWeight: 700,
          color: DECK.green,
          opacity: badge,
          letterSpacing: "0.05em",
        }}
      >
        AVAILABLE FOR CHROME
      </div>
      <div
        style={{
          marginTop: 12,
          padding: "14px 30px",
          borderRadius: 14,
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.14)",
          color: "rgba(255,255,255,.7)",
          fontSize: 18,
          opacity: chip,
          transform: `scale(${chip})`,
        }}
      >
        chrome.google.com/webstore → LinguaScript
      </div>
    </AbsoluteFill>
  );
};

export const LaunchReel = ({ lang = "fr" }: { lang?: Lang }) => {
  const content = CONTENT[lang];
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: "#fff" }}>
      <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.dur}>
        <SceneProblem content={content} />
      </Sequence>
      <Sequence from={SCENES.intro.from} durationInFrames={SCENES.intro.dur}>
        <SceneIntro />
      </Sequence>
      <Sequence from={SCENES.platforms.from} durationInFrames={SCENES.platforms.dur}>
        <ScenePlatforms content={content} />
      </Sequence>
      <Sequence from={SCENES.clickWord.from} durationInFrames={SCENES.clickWord.dur}>
        <SceneClickWord content={content} />
      </Sequence>
      <Sequence from={SCENES.save.from} durationInFrames={SCENES.save.dur}>
        <SceneSave content={content} />
      </Sequence>
      <Sequence from={SCENES.review.from} durationInFrames={SCENES.review.dur}>
        <SceneReview content={content} />
      </Sequence>
      <Sequence from={SCENES.turnGreen.from} durationInFrames={SCENES.turnGreen.dur}>
        <SceneTurnGreen content={content} />
      </Sequence>
      <Sequence from={SCENES.outro.from} durationInFrames={SCENES.outro.dur}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};

export default LaunchReel;
