import { cn } from "@/lib/utils";

/**
 * Two-row platform strip.
 *
 * Top row: streaming platforms LinguaScript runs inside.
 * Bottom row: study tools that share the same spaced-repetition model —
 * shown so students immediately recognise the vocabulary system.
 *
 * All marks drawn as inline SVG: nominative use, crisp at any density,
 * zero network requests.
 */

const YouTube = () => (
  <svg viewBox="0 0 48 34" className="h-7 w-auto" aria-label="YouTube" role="img">
    <rect width="48" height="34" rx="9" fill="#FF0000" />
    <path d="M19.5 10.2 L33 17 L19.5 23.8 Z" fill="#fff" />
  </svg>
);

const Netflix = () => (
  <svg viewBox="0 0 34 34" className="h-7 w-auto" aria-label="Netflix" role="img">
    <rect width="34" height="34" rx="9" fill="#1A1614" />
    <path d="M10.4 5.6 h4.9 l8.3 22.8 h-4.9 z" fill="#B1060F" />
    <path d="M10.4 5.6 h4.6 v22.8 h-4.6 z" fill="#E50914" />
    <path d="M19.1 5.6 h4.6 v22.8 h-4.6 z" fill="#E50914" />
  </svg>
);

const Crunchyroll = () => (
  <svg viewBox="0 0 34 34" className="h-7 w-auto" aria-label="Crunchyroll" role="img">
    <rect width="34" height="34" rx="9" fill="#F47521" />
    <path
      d="M17.4 5.9a11.1 11.1 0 100 22.2c3.6 0 6.8-1.7 8.8-4.4a9 9 0 01-11.6-8.6 9 9 0 016.4-8.6 11 11 0 00-3.6-.6z"
      fill="#fff"
    />
    <circle cx="22.6" cy="17" r="4.3" fill="#fff" />
  </svg>
);

const Anki = () => (
  <svg viewBox="0 0 34 34" className="h-7 w-auto" aria-label="Anki" role="img">
    <rect width="34" height="34" rx="9" fill="#0093D0" />
    {/* three-card fan */}
    <rect x="4" y="12" width="16" height="12" rx="2" fill="rgba(255,255,255,0.22)"
      transform="rotate(-13 12 18)" />
    <rect x="8" y="11" width="16" height="12" rx="2" fill="rgba(255,255,255,0.5)"
      transform="rotate(-5 16 17)" />
    <rect x="12" y="11" width="16" height="12" rx="2" fill="#fff" />
    <rect x="15" y="14.5" width="10" height="1.5" rx="0.75" fill="#0093D0" />
    <rect x="15" y="17.5" width="7" height="1.5" rx="0.75" fill="#0093D0" opacity="0.45" />
  </svg>
);

const Quizlet = () => (
  <svg viewBox="0 0 34 34" className="h-7 w-auto" aria-label="Quizlet" role="img">
    <rect width="34" height="34" rx="9" fill="#4257B2" />
    {/* stylised Q: circle + tail */}
    <circle cx="16" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
    <line x1="21" y1="21" x2="27" y2="27" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const STREAMS = [
  { node: <Netflix />, name: "Netflix" },
  { node: <YouTube />, name: "YouTube" },
  { node: <Crunchyroll />, name: "Crunchyroll" },
];

const STUDY = [
  { node: <Anki />, name: "Anki" },
  { node: <Quizlet />, name: "Quizlet" },
];

const LogoRow = ({ items }: { items: typeof STREAMS }) => (
  <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
    {items.map((p) => (
      <div
        key={p.name}
        className="flex items-center gap-2.5 opacity-60 hover:opacity-100 transition-opacity"
        title={p.name}
      >
        {p.node}
        <span className="text-sm font-semibold text-white/70">{p.name}</span>
      </div>
    ))}
  </div>
);

export const PlatformLogos = ({ className }: { className?: string }) => (
  <div className={cn("flex flex-col items-center gap-8", className)}>
    <div className="flex flex-col items-center gap-4">
      <span className="text-[10px] uppercase tracking-[0.32em] text-white/30">Runs inside</span>
      <LogoRow items={STREAMS} />
    </div>

    <div className="w-px h-5 bg-white/10 hidden sm:block" aria-hidden />

    <div className="flex flex-col items-center gap-4">
      <span className="text-[10px] uppercase tracking-[0.32em] text-white/30">
        Same vocab system as
      </span>
      <LogoRow items={STUDY} />
    </div>
  </div>
);

export default PlatformLogos;
