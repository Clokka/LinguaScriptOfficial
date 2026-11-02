// Premium UI kit — the shared "liquid glass" look for app screens.
// CSS lives in src/index.css (.ls-glass, .ls-deck, .ls-aurora …); these are
// thin React wrappers so every page gets the same cards, numbers and headers.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accent colours as "H S% L%" so CSS can add alpha. */
export const ACCENT = {
  green: "145 63% 49%",
  orange: "32 100% 52%",
  red: "4 100% 59%",
  gold: "42 95% 55%",
  blue: "205 90% 58%",
  violet: "265 85% 68%",
} as const;
export type Accent = keyof typeof ACCENT;

const accentStyle = (accent?: Accent, style?: CSSProperties) =>
  ({ ...(accent ? { ["--ls-accent" as string]: ACCENT[accent] } : {}), ...style }) as CSSProperties;

/** Frosted card with a gradient hairline border. `glow` adds a soft accent halo. */
export function GlassCard({
  accent, glow, className, style, children, as: Tag = "div", ...rest
}: {
  accent?: Accent; glow?: boolean; className?: string; style?: CSSProperties; children?: ReactNode;
  as?: "div" | "section" | "button"; onClick?: () => void; type?: "button"; disabled?: boolean;
  "aria-label"?: string; title?: string; "data-tour"?: string;
}) {
  return (
    <Tag {...rest} className={cn("ls-glass", glow && "ls-glow", className)} style={accentStyle(accent, style)}>
      {children}
    </Tag>
  );
}

/** Number that counts up when it scrolls into view. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), className }: {
  value: number; format?: (n: number) => string; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setShown(value); return; }
    const c = animate(from.current, value, {
      duration: Math.min(1.4, 0.5 + Math.log10(Math.abs(value) + 1) * 0.25),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => setShown(n),
    });
    from.current = value;
    return () => c.stop();
  }, [inView, value, reduce]);
  return <span ref={ref} className={cn("tabular-nums", className)}>{format(shown)}</span>;
}

/** Circular progress ring (0–1). */
export function ProgressRing({ value, size = 64, stroke = 6, accent = "green", children }: {
  value: number; size?: number; stroke?: number; accent?: Accent; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeLinecap="round" strokeWidth={stroke}
          stroke={`hsl(${ACCENT[accent]})`} strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 6px hsl(${ACCENT[accent]} / .6))` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Stat tile: glowing icon chip, count-up number, label. */
export function StatTile({ icon, value, format, label, accent = "green", className }: {
  icon: ReactNode; value: number; format?: (n: number) => string; label: string; accent?: Accent; className?: string;
}) {
  return (
    <GlassCard accent={accent} className={cn("p-5", className)}>
      <div
        className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl"
        style={{ background: `hsl(${ACCENT[accent]} / 0.14)`, color: `hsl(${ACCENT[accent]})`, boxShadow: `0 0 24px -6px hsl(${ACCENT[accent]} / 0.7)` }}
      >
        {icon}
      </div>
      <p className="text-3xl font-black tracking-tight text-foreground"><CountUp value={value} format={format} /></p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{label}</p>
    </GlassCard>
  );
}

/** Sticky glass top bar used by app sub-pages. */
export function PremiumHeader({ title, onBack, right, icon }: {
  title: string; onBack?: () => void; right?: ReactNode; icon?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-background/60 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="ls-chip-glass grid h-10 w-10 place-items-center text-foreground transition hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {icon}
        <h1 className="truncate text-lg font-bold tracking-tight text-foreground">{title}</h1>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

/** Small uppercase label above a section. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground", className)}>{children}</p>;
}

/** Shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("ls-skeleton", className)} aria-hidden />;
}
