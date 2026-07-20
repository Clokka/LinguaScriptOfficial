// Standalone /demo page showcasing the Line Blast prototype.
// Shareable link for feedback before the effect is wired into the real
// watch page (see docs/plans/line-blast-completion-effects.md).
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineBlastDemo } from "@/components/LineBlastDemo";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const Demo = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-emerald-500/8 blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full bg-amber-400/5 blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-10 sm:py-14">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to LinguaScript
          </button>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          className="text-center mb-12"
        >
          <motion.div
            variants={fadeUp}
            custom={1}
            className="inline-flex items-center gap-2 glass-panel rounded-full px-4 py-1.5 mb-5"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold tracking-wide">
              Prototype · Line Blast
            </span>
          </motion.div>
          <motion.h1
            variants={fadeUp}
            custom={2}
            className="text-4xl sm:text-6xl font-bold mb-5 [text-wrap:balance]"
          >
            Complete the line.{" "}
            <span className="text-amber-400">Feel the blast.</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            custom={3}
            className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed"
          >
            Every word you master turns green. When the last white word of a
            subtitle flips, the whole line erupts — Block Blast style. Complete
            consecutive lines to build combos and multiply your XP up to ×5.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={4}
          className="glass-panel-strong rounded-3xl p-3 sm:p-5 border border-border/60 shadow-[0_40px_120px_-40px_rgba(52,211,153,0.35)]"
        >
          <LineBlastDemo />
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center"
        >
          {[
            {
              title: "Tap white words",
              body: "White words are ones you haven't learned. Tap them to mark them known — they dim to green, exactly like the real player.",
            },
            {
              title: "Hit 100% green",
              body: "Function words weigh less than content words, so the score reflects real understanding. At 100%, the line blasts.",
            },
            {
              title: "Chain combos",
              body: "Complete lines back-to-back to climb ×1 → ×5. Skip 8 lines without a completion and the combo resets.",
            },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              variants={fadeUp}
              custom={5 + i}
              className="glass-panel rounded-2xl p-6 border border-border/60"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold">{c.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={8}
          className="mt-14 text-center"
        >
          <Button
            size="lg"
            onClick={() => navigate("/")}
            className="h-13 px-8 rounded-full gap-2 font-semibold"
          >
            Explore LinguaScript
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Demo;
