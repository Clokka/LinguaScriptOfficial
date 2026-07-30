import { motion } from "framer-motion";
import { DECK } from "@/lib/deck-colors";
import { cn } from "@/lib/utils";

/**
 * The three deck cards, exactly as they appear in the app.
 *
 * Solid deck colour, not glass: here the colour IS the information, so
 * anything that desaturates it would be actively wrong. (Glass stays reserved
 * for neutral surfaces where no deck colour sits behind the blur.)
 */
interface Deck {
  colour: string;
  label: string;
  count: string;
  sub: string;
  action: string;
}

const DECKS: Deck[] = [
  { colour: DECK.red, label: "Unknown", count: "22", sub: "Newly saved words", action: "Review" },
  { colour: DECK.orange, label: "Learning", count: "578", sub: "Strengthening words", action: "Review" },
  { colour: DECK.green, label: "Known", count: "2951", sub: "Acquired words", action: "Browse" },
];

export const DeckCards = ({ className }: { className?: string }) => (
  <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
    {DECKS.map((d, i) => (
      <motion.div
        key={d.label}
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-70px" }}
        transition={{ delay: i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -6 }}
        className="rounded-2xl p-6 text-white"
        style={{ backgroundColor: d.colour }}
      >
        <span
          className="block h-7 w-7 rounded-full mb-6"
          style={{ background: "rgba(0,0,0,0.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }}
        />
        <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/90">
          {d.label}
        </span>
        <span className="block text-5xl font-extrabold tabular-nums leading-none mt-1.5 mb-3">
          {d.count}
        </span>
        <span className="block text-sm text-white/85">{d.sub}</span>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white">
          {d.action}
          <span aria-hidden="true">›</span>
        </span>
      </motion.div>
    ))}
  </div>
);

export default DeckCards;
