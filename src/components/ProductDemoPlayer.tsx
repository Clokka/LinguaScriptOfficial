import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  Maximize,
  MousePointer2,
  Star,
  Check,
  Flame,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ProductDemoPlayer
 * Self-contained looping visual demo of the LinguaScript workflow.
 * No external video, no YouTube embed — pure CSS/SVG + framer-motion.
 * Total loop ~22s.
 */

const RED = "#FF3B30";
const ORANGE = "#FF8A00";
const GREEN = "#34C759";

type Scene = 0 | 1 | 2 | 3 | 4 | 5;

const SCENE_DURATIONS: Record<Scene, number> = {
  0: 3200, // watch
  1: 4200, // click word
  2: 3000, // save
  3: 4200, // review flashcard
  4: 4000, // progress
  5: 3400, // final summary
};

const OVERLAY: Record<Scene, string> = {
  0: "📺 Watch real content",
  1: "🧠 Click any word to learn it",
  2: "Save vocabulary instantly",
  3: "Review with spaced repetition",
  4: "Track your progress visually",
  5: "",
};

export const ProductDemoPlayer = () => {
  const [scene, setScene] = useState<Scene>(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setScene((s) => ((s + 1) % 6) as Scene);
    }, SCENE_DURATIONS[scene]);
    return () => clearTimeout(id);
  }, [scene]);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {/* ── Animated café/street background (blurred fake video) ── */}
      <CafeBackdrop />

      {/* dark vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70 pointer-events-none" />

      {/* HUD: streak */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 backdrop-blur-md bg-black/40 ring-1 ring-white/15 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5">
        <Flame className="w-3.5 h-3.5" style={{ color: ORANGE }} />
        <span className="text-[10px] sm:text-xs font-bold text-white">7 day streak</span>
      </div>

      {/* HUD: flashcard icon target (top-left) */}
      <FlashcardTarget scene={scene} />

      {/* Overlay caption (top center) */}
      <AnimatePresence mode="wait">
        {OVERLAY[scene] && (
          <motion.div
            key={`ov-${scene}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="absolute top-12 sm:top-14 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md ring-1 ring-white/10"
          >
            <span className="text-[11px] sm:text-sm font-medium text-white whitespace-nowrap">
              {OVERLAY[scene]}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scenes */}
      <AnimatePresence mode="wait">
        {scene === 0 && <SceneWatch key="s0" />}
        {scene === 1 && <SceneClick key="s1" />}
        {scene === 2 && <SceneSave key="s2" />}
        {scene === 3 && <SceneReview key="s3" />}
        {scene === 4 && <SceneProgress key="s4" />}
        {scene === 5 && <SceneFinal key="s5" />}
      </AnimatePresence>

      {/* Player controls (always visible except final) */}
      {scene !== 5 && <PlayerControls scene={scene} />}
    </div>
  );
};

/* ───────────────────────── Backdrop ───────────────────────── */

const CafeBackdrop = () => (
  <div className="absolute inset-0">
    {/* warm café gradient */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 30% 40%, #7a4a2b 0%, #3a2418 45%, #14110f 100%)",
      }}
    />
    {/* soft window light */}
    <motion.div
      className="absolute -top-20 -left-20 w-[60%] h-[80%] rounded-full"
      style={{
        background: "radial-gradient(circle, rgba(255,210,150,0.35), transparent 70%)",
        filter: "blur(40px)",
      }}
      animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    />
    {/* bokeh */}
    {[
      { x: "20%", y: "65%", s: 80, c: "rgba(255,180,90,0.5)" },
      { x: "70%", y: "30%", s: 110, c: "rgba(255,140,60,0.4)" },
      { x: "82%", y: "70%", s: 60, c: "rgba(255,220,160,0.55)" },
      { x: "45%", y: "20%", s: 90, c: "rgba(255,200,120,0.35)" },
    ].map((b, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          left: b.x,
          top: b.y,
          width: b.s,
          height: b.s,
          background: b.c,
          filter: "blur(24px)",
        }}
        animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
        transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
      />
    ))}
    {/* silhouette figure */}
    <div
      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[55%] h-[70%]"
      style={{
        background:
          "radial-gradient(ellipse at center bottom, rgba(0,0,0,0.55), transparent 70%)",
        filter: "blur(8px)",
      }}
    />
    {/* blur the entire backdrop slightly */}
    <div className="absolute inset-0 backdrop-blur-[2px]" />
  </div>
);

/* ───────────────────────── Player controls ───────────────────────── */

const PlayerControls = ({ scene }: { scene: Scene }) => {
  // fake progress that advances across scenes 0-4
  const pct = ((scene + 1) / 5) * 100;
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-3 sm:px-4 pb-2 sm:pb-3 pt-8 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
      <div className="h-1 rounded-full bg-white/20 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#6366f1,#a855f7)" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="flex items-center gap-3 text-white/90">
        <Pause className="w-4 h-4" />
        <Volume2 className="w-4 h-4" />
        <span className="text-[10px] sm:text-xs tabular-nums">0:0{scene + 2} / 0:18</span>
        <div className="flex-1" />
        <Maximize className="w-4 h-4" />
      </div>
    </div>
  );
};

/* ───────────────────────── Flashcard target (top-left HUD) ───────────────────────── */

const FlashcardTarget = ({ scene }: { scene: Scene }) => {
  const count = scene >= 2 ? 1 : 0;
  return (
    <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-30">
      <motion.div
        animate={scene === 2 ? { scale: [1, 1.25, 1] } : {}}
        transition={{ duration: 0.6, delay: 1.6 }}
        className="relative backdrop-blur-md bg-black/40 ring-1 ring-white/15 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5"
      >
        <div className="w-5 h-4 rounded-sm border border-white/70" />
        <span className="text-[10px] sm:text-xs font-bold text-white tabular-nums">{count}</span>
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
            style={{ background: RED, boxShadow: `0 0 8px ${RED}` }}
          />
        )}
      </motion.div>
    </div>
  );
};

/* ───────────────────────── Subtitle box (shared shell) ───────────────────────── */

type WordColor = "default" | "red" | "orange" | "green";
const COLOR_HEX: Record<WordColor, string | undefined> = {
  default: undefined,
  red: RED,
  orange: ORANGE,
  green: GREEN,
};

const SubtitleBox = ({
  fr,
  en,
  highlightIdx,
  highlightColor = "default",
  wordColor = "default",
  showCursor = false,
  cursorOn,
}: {
  fr: string[];
  en: string;
  highlightIdx?: number;
  highlightColor?: WordColor;
  wordColor?: WordColor;
  showCursor?: boolean;
  cursorOn?: "word" | "save";
}) => (
  <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 w-[min(92%,640px)] z-20">
    <div className="relative rounded-2xl bg-black/55 backdrop-blur-md ring-1 ring-white/10 px-5 py-3 sm:px-6 sm:py-4 text-center shadow-2xl">
      <p className="text-lg sm:text-2xl font-semibold text-white leading-snug mb-1">
        {fr.map((w, i) => {
          const isHi = i === highlightIdx;
          const hex = isHi ? COLOR_HEX[highlightColor] : COLOR_HEX[wordColor];
          return (
            <span
              key={i}
              data-word={i === 0 ? "bonjour" : undefined}
              className={cn(
                "inline-block mx-0.5 px-1.5 rounded-md transition-colors",
                isHi && "ring-1 ring-white/30 bg-white/10",
              )}
              style={hex ? { color: hex } : undefined}
            >
              {w}
            </span>
          );
        })}
      </p>
      <p className="text-xs sm:text-sm text-white/65 font-light">{en}</p>
    </div>
  </div>
);

/* ───────────────────────── Cursor ───────────────────────── */

const AnimatedCursor = ({
  from,
  to,
  delay = 0,
  duration = 0.9,
  clickAt,
}: {
  from: { x: string | number; y: string | number };
  to: { x: string | number; y: string | number };
  delay?: number;
  duration?: number;
  clickAt?: number;
}) => (
  <>
    <motion.div
      className="absolute z-40 pointer-events-none"
      initial={{ left: from.x as any, top: from.y as any, opacity: 0, scale: 0.8 }}
      animate={{
        left: to.x as any,
        top: to.y as any,
        opacity: 1,
        scale: 1,
      }}
      transition={{
        left: { duration, delay, ease: [0.5, 0, 0.2, 1] },
        top: { duration, delay, ease: [0.5, 0, 0.2, 1] },
        opacity: { duration: 0.2, delay },
      }}
    >
      <MousePointer2 className="w-6 h-6 text-white fill-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
    </motion.div>
    {clickAt !== undefined && (
      <motion.div
        className="absolute z-30 pointer-events-none rounded-full"
        initial={{ left: to.x as any, top: to.y as any, opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0.7, 0], scale: [0, 2.5, 3] }}
        transition={{ duration: 0.7, delay: clickAt, ease: "easeOut" }}
        style={{
          width: 24,
          height: 24,
          marginLeft: -12,
          marginTop: -12,
          background: "rgba(255,255,255,0.4)",
        }}
      />
    )}
  </>
);

/* ───────────────────────── Scenes ───────────────────────── */

const FR = ["Bonjour,", "comment", "ça", "va?"];
const EN = "Hello, how are you?";

const SceneWatch = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
    className="absolute inset-0"
  >
    <SubtitleBox fr={FR} en={EN} />
  </motion.div>
);

const SceneClick = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
    className="absolute inset-0"
  >
    <SubtitleBox fr={FR} en={EN} highlightIdx={0} highlightColor="default" />
    {/* Cursor moves to the word "Bonjour" then a popup appears */}
    <AnimatedCursor
      from={{ x: "85%", y: "30%" }}
      to={{ x: "32%", y: "76%" }}
      duration={1.2}
      clickAt={1.4}
    />
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.7, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="absolute z-30 left-[10%] sm:left-[14%] bottom-[42%] w-[210px] sm:w-[240px] rounded-2xl bg-[#1a1730]/95 backdrop-blur-xl ring-1 ring-white/15 shadow-2xl p-3 sm:p-4"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p
            className="text-xl sm:text-2xl font-bold leading-none"
            style={{
              background: "linear-gradient(90deg,#a78bfa,#f0abfc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            bonjour
          </p>
          <p className="text-[10px] text-white/50 mt-1">/bɔ̃.ʒuʁ/</p>
        </div>
        <div className="w-7 h-7 rounded-md bg-white/10 ring-1 ring-white/15 flex items-center justify-center">
          <Volume2 className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <div className="bg-white/5 rounded-lg px-2.5 py-2 mb-2">
        <p className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Translation</p>
        <p className="text-white font-semibold text-sm">hello</p>
      </div>
      <button
        className="w-full rounded-lg text-white text-xs font-semibold py-2 flex items-center justify-center gap-1.5"
        style={{ background: "linear-gradient(90deg,#10b981,#059669)" }}
      >
        <Star className="w-3 h-3" />
        Save to Flashcards
      </button>
    </motion.div>
  </motion.div>
);

const SceneSave = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
    className="absolute inset-0"
  >
    <SubtitleBox fr={FR} en={EN} highlightIdx={0} highlightColor="red" />
    {/* "+1" badge floats from popup zone toward flashcard target */}
    <motion.div
      className="absolute z-40 left-[24%] bottom-[58%]"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: [0, 1, 1, 1, 0],
        left: ["24%", "24%", "16%", "8%", "5%"],
        top: ["auto", "auto", "auto", "auto", "auto"],
        bottom: ["58%", "58%", "70%", "84%", "92%"],
        scale: [0.6, 1, 1, 0.7, 0.4],
      }}
      transition={{ duration: 2.2, ease: "easeInOut", times: [0, 0.15, 0.5, 0.85, 1] }}
    >
      <div
        className="rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg flex items-center gap-1"
        style={{ background: RED, boxShadow: `0 0 16px ${RED}88` }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        +1 New Word
      </div>
    </motion.div>
    {/* Banner */}
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.3 }}
      className="absolute top-24 sm:top-28 left-1/2 -translate-x-1/2 z-30 rounded-full px-3 py-1.5 text-xs font-bold text-white"
      style={{ background: RED }}
    >
      🔴 Added to New Words
    </motion.div>
  </motion.div>
);

const SceneReview = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {/* dim the cafe behind a review surface */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Flashcard */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20"
        style={{ perspective: 1000 }}
      >
        <motion.div
          className="relative w-[260px] h-[160px] sm:w-[320px] sm:h-[190px]"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: [0, 0, 180, 180] }}
          transition={{ duration: 4.2, times: [0, 0.3, 0.55, 1], ease: "easeInOut" }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1f1b3a] to-[#0f0d1f] ring-1 ring-white/15 flex flex-col items-center justify-center shadow-2xl"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">French</p>
            <p className="text-3xl sm:text-4xl font-bold text-white">bonjour</p>
            <p className="text-[10px] text-white/40 mt-3">Tap to flip</p>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1a2e26] to-[#0f1d18] ring-1 ring-white/15 flex flex-col items-center justify-center shadow-2xl"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">English</p>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: GREEN }}>
              hello
            </p>
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.4, duration: 0.3 }}
              className="mt-4 rounded-lg px-3 py-1.5 text-xs font-bold text-white flex items-center gap-1.5"
              style={{ background: GREEN }}
            >
              <Check className="w-3 h-3" /> Got it
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Cursor: flip click then Got it click */}
      <AnimatedCursor
        from={{ x: "20%", y: "80%" }}
        to={{ x: "50%", y: "50%" }}
        duration={0.9}
        delay={0.2}
        clickAt={1.0}
      />
      <motion.div
        className="absolute z-40 pointer-events-none"
        initial={{ left: "50%", top: "50%", opacity: 0 }}
        animate={{ left: "55%", top: "70%", opacity: 1 }}
        transition={{ delay: 2.6, duration: 0.5 }}
      >
        <MousePointer2 className="w-6 h-6 text-white fill-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
      </motion.div>

      {/* Promotion badge */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 3.4, duration: 0.4 }}
        className="absolute bottom-20 sm:bottom-24 z-30 rounded-full px-3 py-1.5 text-xs font-bold text-white flex items-center gap-2"
        style={{
          background: "linear-gradient(90deg,#FF3B30,#FF8A00)",
        }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: RED }} />
        New
        <ArrowRight className="w-3 h-3" />
        <span className="w-2 h-2 rounded-full" style={{ background: ORANGE }} />
        Learning
      </motion.div>
    </motion.div>
  );
};

const SceneProgress = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
    className="absolute inset-0"
  >
    {/* keep subtitle visible but now green */}
    <SubtitleBox fr={FR} en={EN} highlightIdx={0} highlightColor="green" />

    {/* Promotion arrow Orange→Green */}
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute top-24 sm:top-28 left-1/2 -translate-x-1/2 z-30 rounded-full px-3 py-1.5 text-xs font-bold text-white flex items-center gap-2"
      style={{ background: "linear-gradient(90deg,#FF8A00,#34C759)" }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: ORANGE }} /> Learning
      <ArrowRight className="w-3 h-3" />
      <span className="w-2 h-2 rounded-full" style={{ background: GREEN }} /> Learned
    </motion.div>

    {/* Stats card */}
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="absolute z-30 right-3 sm:right-5 top-1/2 -translate-y-1/2 rounded-2xl p-4 sm:p-5 bg-black/65 backdrop-blur-xl ring-1 ring-white/15 shadow-2xl w-[180px] sm:w-[220px]"
    >
      <div className="mb-3">
        <p className="text-[9px] uppercase tracking-wider text-white/50 mb-1">
          French Understanding
        </p>
        <div className="flex items-baseline gap-1">
          <motion.span
            className="text-3xl sm:text-4xl font-extrabold tabular-nums"
            style={{ color: GREEN }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <CountUp to={74} duration={1.4} delay={0.8} />
          </motion.span>
          <span className="text-lg font-bold text-white/70">%</span>
        </div>
        <div className="h-1.5 mt-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full"
            style={{ background: GREEN }}
            initial={{ width: 0 }}
            animate={{ width: "74%" }}
            transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
          />
        </div>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-white/50 mb-1">Words Learned</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
            <CountUp to={421} duration={1.4} delay={1.0} />
          </span>
          <Sparkles className="w-3.5 h-3.5" style={{ color: ORANGE }} />
        </div>
      </div>
    </motion.div>
  </motion.div>
);

const SceneFinal = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
    className="absolute inset-0 z-30 flex items-center justify-center"
  >
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
    <div className="relative z-10 text-center px-6">
      {[
        { t: "Watch Content", c: "text-white" },
        { t: "Save Words", c: "text-white" },
        { t: "Review Flashcards", c: "text-white" },
      ].map((s, i) => (
        <motion.div
          key={s.t}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15, duration: 0.4 }}
          className="mb-1.5"
        >
          <p className={cn("text-sm sm:text-base font-semibold", s.c)}>{s.t}</p>
          <p className="text-white/30 text-xs">↓</p>
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="inline-flex items-center gap-2 my-2"
      >
        <Dot color={RED} />
        <ArrowRight className="w-3 h-3 text-white/50" />
        <Dot color={ORANGE} />
        <ArrowRight className="w-3 h-3 text-white/50" />
        <Dot color={GREEN} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-white/30 text-xs mb-1"
      >
        ↓
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95, duration: 0.4 }}
        className="text-base sm:text-lg font-bold mb-5"
        style={{
          background: "linear-gradient(90deg,#a78bfa,#f0abfc)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Understand Real French
      </motion.p>
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.45 }}
        className="px-6 py-3 rounded-xl text-white font-semibold text-sm shadow-2xl hover:scale-105 transition-transform"
        style={{
          background: "linear-gradient(90deg,#6366f1,#a855f7)",
          boxShadow: "0 0 30px rgba(168,85,247,0.45)",
        }}
      >
        Start Learning Free
      </motion.button>
    </div>
  </motion.div>
);

const Dot = ({ color }: { color: string }) => (
  <span
    className="w-3 h-3 rounded-full"
    style={{ background: color, boxShadow: `0 0 10px ${color}` }}
  />
);

/* ───────────────────────── CountUp ───────────────────────── */
const CountUp = ({
  to,
  duration = 1.2,
  delay = 0,
}: {
  to: number;
  duration?: number;
  delay?: number;
}) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const t0 = performance.now() + delay * 1000;
    const tick = (t: number) => {
      if (t < t0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!start) start = t;
      const p = Math.min(1, (t - start) / (duration * 1000));
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay]);
  return <>{n}</>;
};

export default ProductDemoPlayer;
