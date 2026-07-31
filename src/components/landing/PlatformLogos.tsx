import { cn } from "@/lib/utils";

/**
 * "Works on" strip — the real platform marks, drawn as inline SVG.
 *
 * SVG rather than bitmaps so they stay crisp at any density and cost a few
 * hundred bytes instead of a network request each. These are third-party
 * trademarks used nominatively to say where LinguaScript runs.
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

const PLATFORMS = [
  { node: <YouTube />, name: "YouTube" },
  { node: <Netflix />, name: "Netflix" },
  { node: <Crunchyroll />, name: "Crunchyroll" },
];

export const PlatformLogos = ({ className }: { className?: string }) => (
  <div className={cn("flex flex-col items-center gap-5", className)}>
    <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">Works on</span>
    <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-5">
      {PLATFORMS.map((p) => (
        <div
          key={p.name}
          className="flex items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity"
          title={p.name}
        >
          {p.node}
          <span className="text-sm font-semibold text-white/70">{p.name}</span>
        </div>
      ))}
    </div>
  </div>
);

export default PlatformLogos;
