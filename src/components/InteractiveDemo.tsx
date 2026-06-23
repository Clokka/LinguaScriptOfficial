import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, MousePointer2, Plus, Sparkles, Volume2, Maximize2, Library, Layers,
} from "lucide-react";
import { playDing } from "@/lib/sound";

/**
 * Scripted product tour overlaid on the real catalogue video
 * "Ma routine d'apprentissage pour parler 7 langues" (YT id 2zUALT7zUy8).
 *
 * Animated fake cursor walks the user through the entire LinguaScript loop:
 *   1. Dual subtitles
 *   2. Click word
 *   3. Pronunciation audio
 *   4. Fullscreen
 *   5. Browse catalogue
 *   6. Flashcards
 *
 * The user clicks each highlighted target to advance; calls onComplete after stage 6.
 */
const VIDEO_ID = "2zUALT7zUy8";
const PHRASE = ["Ma", "routine", "d'apprentissage", "pour", "parler", "7", "langues"];
const TARGET_WORD_INDEX = 1; // "routine"
const TARGET_TRANSLATION = "routine";

type Stage = "dual" | "click" | "pron" | "fullscreen" | "catalogue" | "flashcards" | "done";

const STAGE_ORDER: Stage[] = ["dual", "click", "pron", "fullscreen", "catalogue", "flashcards", "done"];

const STAGE_COPY: Record<Stage, string> = {
  dual: "Tap 'Dual subtitles' to switch on the translation track.",
  click: "Click the highlighted word to see what it means.",
  pron: "Tap the speaker to hear native pronunciation.",
  fullscreen: "Go fullscreen — subtitles stay perfectly in sync.",
  catalogue: "Browse handpicked videos at your level.",
  flashcards: "Words you save become spaced-repetition flashcards.",
  done: "That's the whole LinguaScript loop. Ready to learn for real?",
};

// Cursor target positions (relative to player container, percentage)
const CURSOR_TARGETS: Record<Exclude<Stage, "done">, { x: string; y: string }> = {
  dual:       { x: "calc(100% - 90px)", y: "calc(100% - 50px)" },
  click:      { x: "44%", y: "70%" },
  pron:       { x: "50%", y: "32%" },
  fullscreen: { x: "calc(100% - 40px)", y: "30px" },
  catalogue:  { x: "20%", y: "50%" },
  flashcards: { x: "80%", y: "50%" },
};

export const InteractiveDemo = ({ onComplete }: { onComplete: () => void }) => {
  const [stage, setStage] = useState<Stage>("dual");
  const [dualOn, setDualOn] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [pronPlayed, setPronPlayed] = useState(false);
  const [savedFly, setSavedFly] = useState(false);
  const [deckCount, setDeckCount] = useState(0);
  const [fakeFullscreen, setFakeFullscreen] = useState(false);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);

  const stageIndex = STAGE_ORDER.indexOf(stage);

  useEffect(() => {
    if (stage === "done") onComplete();
  }, [stage, onComplete]);

  const advance = () => {
    const next = STAGE_ORDER[stageIndex + 1];
    if (next) setStage(next);
  };

  const handleDual = () => {
    if (stage !== "dual") return;
    playDing("soft");
    setDualOn(true);
    advance();
  };

  const handleWord = () => {
    if (stage !== "click") return;
    playDing("soft");
    setPopupOpen(true);
    advance();
  };

  const handlePron = () => {
    if (stage !== "pron") return;
    playDing("soft");
    setPronPlayed(true);
    // Fire native TTS for authenticity
    try {
      const u = new SpeechSynthesisUtterance("routine");
      u.lang = "fr-FR";
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch {
      /* noop */
    }
    setTimeout(() => {
      // Save the word at same time, fly into deck
      setSavedFly(true);
      setTimeout(() => {
        setDeckCount(1);
        setSavedFly(false);
        setPopupOpen(false);
        advance();
      }, 700);
    }, 600);
  };

  const handleFullscreen = () => {
    if (stage !== "fullscreen") return;
    playDing("soft");
    setFakeFullscreen(true);
    setTimeout(() => {
      setFakeFullscreen(false);
      advance();
    }, 1200);
  };

  const handleCatalogue = () => {
    if (stage !== "catalogue") return;
    playDing("soft");
    setShowCatalogue(true);
    setTimeout(() => {
      setShowCatalogue(false);
      advance();
    }, 1600);
  };

  const handleFlashcards = () => {
    if (stage !== "flashcards") return;
    playDing("success");
    setShowFlashcards(true);
    setTimeout(() => {
      setShowFlashcards(false);
      advance();
    }, 1600);
  };

  const cursor = stage !== "done" ? CURSOR_TARGETS[stage] : null;

  return (
    <div className="space-y-4">
      {/* Player */}
      <motion.div
        animate={fakeFullscreen ? { scale: 1.03 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="relative rounded-3xl overflow-hidden border border-orange-100 bg-neutral-900 aspect-video shadow-[0_24px_60px_-30px_rgba(249,115,22,0.4)]"
      >
        {/* Real YouTube video, muted + looped — pure ambience */}
        <iframe
          title="LinguaScript demo"
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&controls=0&loop=1&playlist=${VIDEO_ID}&modestbranding=1&rel=0&playsinline=1&disablekb=1`}
          allow="autoplay; encrypted-media"
          className="absolute inset-0 w-full h-full pointer-events-none"
          frameBorder={0}
        />

        {/* Subtle dim so subtitles read */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 pointer-events-none" />

        {/* Subtitle area */}
        <div className="absolute bottom-14 left-0 right-0 px-4 text-center pointer-events-none">
          <p className="text-white text-base sm:text-xl font-medium drop-shadow-lg leading-relaxed">
            {PHRASE.map((w, i) => {
              const isTarget = i === TARGET_WORD_INDEX;
              const clickable = isTarget && stage === "click";
              return (
                <span key={i}>
                  <span
                    onClick={clickable ? handleWord : undefined}
                    className={
                      isTarget
                        ? clickable
                          ? "underline decoration-orange-400 decoration-2 underline-offset-4 cursor-pointer hover:text-orange-300 transition pointer-events-auto"
                          : popupOpen || stageIndex > 1
                          ? "text-orange-300"
                          : ""
                        : ""
                    }
                  >
                    {w}
                  </span>
                  {i < PHRASE.length - 1 && " "}
                </span>
              );
            })}
          </p>
          <AnimatePresence>
            {dualOn && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-orange-300 text-xs sm:text-sm mt-1.5 font-light"
              >
                My learning routine to speak 7 languages
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Word translation popup */}
        <AnimatePresence>
          {popupOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute left-1/2 -translate-x-1/2 top-[26%] z-20 w-[220px] rounded-2xl bg-white shadow-2xl p-3 text-left"
            >
              <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-medium">
                French → English
              </p>
              <p className="text-base font-semibold text-neutral-900 mt-0.5">routine</p>
              <p className="text-sm text-orange-600">{TARGET_TRANSLATION}</p>
              <button
                onClick={handlePron}
                disabled={stage !== "pron"}
                className={`mt-1.5 w-full rounded-lg text-xs font-medium py-1.5 flex items-center justify-center gap-1.5 transition ${
                  stage === "pron"
                    ? "bg-orange-100 text-orange-700 hover:bg-orange-200 animate-pulse"
                    : pronPlayed
                    ? "bg-orange-50 text-orange-600"
                    : "bg-neutral-50 text-neutral-400"
                }`}
              >
                <Volume2 className="w-3 h-3" /> /ʁu.tin/
              </button>
              {(stage === "pron" || stage === "fullscreen" || stage === "catalogue" || stage === "flashcards" || stage === "done") && (
                <div className="mt-2 w-full rounded-lg bg-orange-500/90 text-white text-xs font-medium py-1.5 flex items-center justify-center gap-1">
                  <Plus className="w-3 h-3" /> {pronPlayed ? "Saved!" : "Save to deck"}
                </div>
              )}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flying card → deck */}
        <AnimatePresence>
          {savedFly && (
            <motion.div
              initial={{ left: "50%", top: "30%", opacity: 1, scale: 1 }}
              animate={{ left: "calc(100% - 70px)", top: "12px", opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.7, ease: "easeIn" }}
              className="absolute w-12 h-8 rounded-md bg-orange-400 shadow-lg z-30"
            />
          )}
        </AnimatePresence>

        {/* Catalogue mini-grid reveal */}
        <AnimatePresence>
          {showCatalogue && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-20 grid grid-cols-3 gap-2"
            >
              {[
                "from-orange-300 to-orange-400",
                "from-rose-300 to-orange-300",
                "from-amber-300 to-orange-400",
                "from-orange-400 to-rose-400",
                "from-yellow-300 to-orange-300",
                "from-orange-300 to-amber-400",
              ].map((g, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`aspect-video rounded-lg bg-gradient-to-br ${g} shadow-lg`}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flashcards reveal */}
        <AnimatePresence>
          {showFlashcards && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <div className="relative w-44 h-28">
                {[2, 1, 0].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
                    animate={{ opacity: 1, x: i * 6, y: i * -4, rotate: i * -3 }}
                    transition={{ delay: i * 0.08 }}
                    className="absolute inset-0 rounded-2xl bg-white shadow-2xl border border-orange-100 flex flex-col justify-center items-center text-center px-3"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-orange-500 font-medium">
                      Flashcard {i + 1}
                    </p>
                    <p className="text-base font-semibold text-neutral-900 mt-1">routine</p>
                    <p className="text-xs text-neutral-500">routine · /ʁu.tin/</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top-right: Deck + Fullscreen */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur text-white text-xs">
            <Sparkles className="w-3.5 h-3.5 text-orange-300" />
            Deck
            <motion.span
              key={deckCount}
              initial={{ scale: 1.6, color: "#fb923c" }}
              animate={{ scale: 1, color: "#ffffff" }}
              className="font-semibold tabular-nums"
            >
              {deckCount}
            </motion.span>
          </div>
          <button
            onClick={handleFullscreen}
            disabled={stage !== "fullscreen"}
            className={`p-1.5 rounded-full backdrop-blur transition ${
              stage === "fullscreen"
                ? "bg-white/95 text-neutral-900 animate-pulse shadow-lg"
                : "bg-black/40 text-white/70"
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom-right: Dual subtitle button */}
        <button
          onClick={handleDual}
          disabled={stage !== "dual"}
          className={`absolute right-3 bottom-3 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1 z-10 ${
            stage === "dual"
              ? "bg-white/95 text-neutral-900 hover:bg-white animate-pulse shadow-lg"
              : dualOn
              ? "bg-orange-500 text-white"
              : "bg-black/40 text-white/70"
          }`}
        >
          {dualOn ? (
            <>
              <Check className="w-3.5 h-3.5" /> Dual subtitles ON
            </>
          ) : (
            "Dual subtitles"
          )}
        </button>

        {/* Bottom-left: stand-in catalogue / flashcards quick targets */}
        {(stage === "catalogue" || stage === "flashcards") && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
            <button
              onClick={handleCatalogue}
              disabled={stage !== "catalogue"}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                stage === "catalogue"
                  ? "bg-white/95 text-neutral-900 animate-pulse shadow-lg"
                  : "bg-black/40 text-white/70"
              }`}
            >
              <Library className="w-3.5 h-3.5" /> Browse
            </button>
            <button
              onClick={handleFlashcards}
              disabled={stage !== "flashcards"}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                stage === "flashcards"
                  ? "bg-white/95 text-neutral-900 animate-pulse shadow-lg"
                  : "bg-black/40 text-white/70"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Flashcards
            </button>
          </div>
        )}

        {/* Animated fake cursor */}
        <AnimatePresence>
          {cursor && (
            <motion.div
              key={stage}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: 1, scale: 1,
                left: cursor.x, top: cursor.y,
              }}
              exit={{ opacity: 0 }}
              transition={{
                left: { type: "spring", stiffness: 90, damping: 18 },
                top: { type: "spring", stiffness: 90, damping: 18 },
                opacity: { duration: 0.25 },
              }}
              className="absolute pointer-events-none z-40 -translate-x-2 -translate-y-2"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <MousePointer2 className="w-6 h-6 text-white drop-shadow-[0_2px_8px_rgba(249,115,22,0.9)] fill-orange-400" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stage progress dots */}
      <div className="grid grid-cols-6 gap-1.5">
        {(["dual", "click", "pron", "fullscreen", "catalogue", "flashcards"] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all ${
              stageIndex > i
                ? "bg-orange-500"
                : stageIndex === i
                ? "bg-orange-400"
                : "bg-orange-100"
            }`}
          />
        ))}
      </div>

      <p className="text-sm text-center text-neutral-600 min-h-[1.25rem]">
        {stage === "done" ? (
          <span className="text-orange-600 font-medium">{STAGE_COPY.done} ✨</span>
        ) : (
          STAGE_COPY[stage]
        )}
      </p>
    </div>
  );
};
