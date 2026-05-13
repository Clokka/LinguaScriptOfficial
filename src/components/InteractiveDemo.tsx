import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MousePointer2, Plus, Sparkles, Volume2 } from "lucide-react";
import { playDing } from "@/lib/sound";

/**
 * 3-step interactive mini-player demo for onboarding.
 * Step A: toggle dual subtitles
 * Step B: click a highlighted word → translation popup
 * Step C: tap "Save to deck" → flashcard flies into deck
 *
 * Calls onComplete once all 3 steps are completed.
 */
type Stage = "dual" | "click" | "save" | "done";

const PHRASE = ["Bonjour,", "comment", "ça", "va", "?"];
const TARGET_WORD_INDEX = 1; // "comment"
const TARGET_TRANSLATION = "how";

export const InteractiveDemo = ({ onComplete }: { onComplete: () => void }) => {
  const [stage, setStage] = useState<Stage>("dual");
  const [showHint, setShowHint] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [savedFly, setSavedFly] = useState(false);
  const [deckCount, setDeckCount] = useState(0);

  // Idle hint after 2s of inactivity per step
  useEffect(() => {
    setShowHint(false);
    const t = setTimeout(() => setShowHint(true), 2000);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (stage === "done") onComplete();
  }, [stage, onComplete]);

  const handleDual = () => {
    if (stage !== "dual") return;
    playDing("soft");
    setStage("click");
  };

  const handleWord = () => {
    if (stage !== "click") return;
    playDing("soft");
    setPopupOpen(true);
    setStage("save");
  };

  const handleSave = () => {
    if (stage !== "save") return;
    playDing("success");
    setSavedFly(true);
    setTimeout(() => {
      setDeckCount(1);
      setSavedFly(false);
      setPopupOpen(false);
      setStage("done");
    }, 700);
  };

  return (
    <div className="space-y-4">
      {/* Mini player */}
      <div className="relative rounded-3xl overflow-hidden border border-orange-100 bg-gradient-to-br from-neutral-900 to-neutral-800 aspect-video">
        {/* Fake video frame */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_30%,rgba(249,115,22,0.4),transparent_60%)]" />

        {/* Subtitle area */}
        <div className="absolute bottom-16 left-0 right-0 px-4 text-center">
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
                          ? "underline decoration-orange-400 decoration-2 underline-offset-4 cursor-pointer hover:text-orange-300 transition"
                          : stage === "save" || stage === "done"
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
            {(stage === "click" || stage === "save" || stage === "done") && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-orange-300 text-xs sm:text-sm mt-1.5 font-light"
              >
                Hello, how are you?
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
              className="absolute left-1/2 -translate-x-1/2 top-[18%] sm:top-[24%] z-10 w-[200px] rounded-2xl bg-white shadow-2xl p-3 text-left"
            >
              <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-medium">French → English</p>
              <p className="text-base font-semibold text-neutral-900 mt-0.5">comment</p>
              <p className="text-sm text-orange-600">{TARGET_TRANSLATION}</p>
              <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> /kɔ.mɑ̃/
              </p>
              {stage === "save" && (
                <motion.button
                  onClick={handleSave}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium py-1.5 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Save to deck
                </motion.button>
              )}
              {/* tail */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flying card animation */}
        <AnimatePresence>
          {savedFly && (
            <motion.div
              initial={{ left: "50%", top: "30%", opacity: 1, scale: 1 }}
              animate={{ left: "calc(100% - 70px)", top: "12px", opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.7, ease: "easeIn" }}
              className="absolute w-12 h-8 rounded-md bg-orange-400 shadow-lg z-20"
            />
          )}
        </AnimatePresence>

        {/* Deck icon (top-right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur text-white text-xs">
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

        {/* Dual subtitles button (always visible bottom-right) */}
        <button
          onClick={handleDual}
          disabled={stage !== "dual"}
          className={`absolute right-3 bottom-3 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
            stage === "dual"
              ? "bg-white/95 text-neutral-900 hover:bg-white animate-pulse shadow-lg"
              : "bg-orange-500 text-white"
          }`}
        >
          {stage === "dual" ? (
            "Dual subtitles"
          ) : (
            <>
              <Check className="w-3.5 h-3.5" /> Dual subtitles on
            </>
          )}
        </button>

        {/* Idle hint cursor */}
        <AnimatePresence>
          {showHint && stage !== "done" && (
            <motion.div
              key={stage}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-none"
              style={
                stage === "dual"
                  ? { right: "1.5rem", bottom: "3.5rem" }
                  : stage === "click"
                  ? { left: "calc(50% - 50px)", bottom: "3rem" }
                  : { left: "calc(50% + 30px)", top: "30%" }
              }
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <MousePointer2 className="w-6 h-6 text-orange-300 drop-shadow-lg fill-orange-300/40" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Step caption */}
      <div className="grid grid-cols-3 gap-2">
        <StepDot active={stage === "dual"} done={stage !== "dual"} label="Dual subs" />
        <StepDot active={stage === "click"} done={stage === "save" || stage === "done"} label="Click word" />
        <StepDot active={stage === "save"} done={stage === "done"} label="Save card" />
      </div>

      <p className="text-sm text-center text-neutral-600 min-h-[1.25rem]">
        {stage === "dual" && "Tap “Dual subtitles” to see the translation appear."}
        {stage === "click" && "Now click the underlined word."}
        {stage === "save" && "Tap “Save to deck” to add it to your flashcards."}
        {stage === "done" && (
          <span className="text-orange-600 font-medium">
            Nice — that's the entire Linguascript loop. ✨
          </span>
        )}
      </p>
    </div>
  );
};

const StepDot = ({ active, done, label }: { active: boolean; done: boolean; label: string }) => (
  <div
    className={`rounded-xl px-3 py-2 text-center text-xs font-medium border transition ${
      done
        ? "bg-orange-500 border-orange-500 text-white"
        : active
        ? "bg-white border-orange-300 text-orange-600 shadow-[0_4px_12px_-4px_rgba(249,115,22,0.4)]"
        : "bg-orange-50/60 border-orange-100 text-neutral-400"
    }`}
  >
    {done ? <Check className="w-3.5 h-3.5 inline -mt-0.5 mr-1" /> : null}
    {label}
  </div>
);
