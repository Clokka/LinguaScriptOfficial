import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

/**
 * The Chameleon Method's three pillars (after Kató Lomb):
 * 📖 read + watch · ✍️ write · 🗣️ speak. Symbols, not copy.
 */
const PILLARS = [
  { path: "/discover", emoji: "📖", label: "Read & watch" },
  { path: "/write", emoji: "✍️", label: "Write" },
  { path: "/speak", emoji: "🗣️", label: "Speak" },
];

export function PillarsNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate("/discover")} aria-label="Back" className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <BrandMark variant="pin" size={26} />
        <div className="flex-1" />
        <nav className="flex gap-1.5" aria-label="Pillars">
          {PILLARS.map((p) => {
            const on = pathname.startsWith(p.path);
            return (
              <button
                key={p.path}
                onClick={() => navigate(p.path)}
                title={p.label}
                aria-label={p.label}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "w-11 h-11 rounded-2xl text-xl grid place-items-center border transition-all",
                  on ? "border-primary bg-primary/15 scale-105" : "border-border bg-card hover:border-primary/50",
                )}
              >
                {p.emoji}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/** One word chip in its deck colour. */
export function WordChip({
  word,
  colour,
  done = false,
  sub,
  onClick,
}: {
  word: string;
  colour: string;
  done?: boolean;
  sub?: string | null;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      translate="no"
      className={cn(
        "inline-flex flex-col items-start rounded-2xl px-3.5 py-2 border-2 transition-all text-left",
        done && "scale-[1.03]",
        !onClick && "cursor-default",
      )}
      style={{ borderColor: colour, background: done ? colour : `${colour}1f`, color: done ? "#08080B" : colour }}
    >
      <span className="font-bold text-base leading-tight">
        {done ? "✓ " : ""}
        {word}
      </span>
      {sub ? (
        <span className="text-xs opacity-80 leading-tight" translate="yes" style={{ color: done ? "#08080B" : undefined }}>
          {sub}
        </span>
      ) : null}
    </button>
  );
}
