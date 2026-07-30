import { cn } from "@/lib/utils";

/**
 * Store CTAs for the hero.
 *
 * TODO(rowan): replace these with the real listing URLs. Every href below is a
 * placeholder — the buttons are deliberately rendered as disabled-looking and
 * are not clickable until a real URL is supplied, so we never ship a dead CTA.
 */
export const STORE_LINKS = {
  chrome: "", // https://chromewebstore.google.com/detail/...
  ios: "", //    https://apps.apple.com/app/id...
  android: "", // https://play.google.com/store/apps/details?id=...
} as const;

const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.54c.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.42-.14-2.76.83-3.48.83-.71 0-1.82-.81-2.99-.79-1.54.02-2.96.89-3.75 2.26-1.6 2.77-.41 6.88 1.15 9.13.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 2.99.72 1.23-.02 2.02-1.12 2.78-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65zM14.8 5.6c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.66 1.37-.58.68-1.09 1.76-.95 2.8 1.01.08 2.04-.52 2.67-1.27z" />
  </svg>
);

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
    <path d="M3.6 2.3c-.3.3-.5.8-.5 1.4v16.6c0 .6.2 1.1.5 1.4l.1.1 9.3-9.3v-.2L3.6 2.3z" fill="#00D2FF" />
    <path d="M16.2 15.6l-3.1-3.1v-.2l3.1-3.1.1.1 3.7 2.1c1.1.6 1.1 1.6 0 2.2l-3.8 2z" fill="#FFC800" />
    <path d="M16.3 15.5L13.1 12.4 3.6 21.9c.4.4 1 .4 1.7.1l11-6.5" fill="#FF3A44" />
    <path d="M16.3 8.5L5.3 2c-.7-.4-1.3-.3-1.7.1l9.5 9.4 3.2-3z" fill="#00C853" />
  </svg>
);

const ChromeGlyph = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#fff" />
    <path d="M12 2a10 10 0 018.66 5H12a5 5 0 00-4.62 3.09L4.2 5.5A10 10 0 0112 2z" fill="#EA4335" />
    <path d="M20.66 7A10 10 0 0112 22l4.33-7.5A5 5 0 0017 12a5 5 0 00-.38-1.91z" fill="#FBBC05" />
    <path d="M12 22A10 10 0 014.2 5.5l4.33 7.5A5 5 0 0012 17a5 5 0 001.33-.18z" fill="#34A853" />
    <circle cx="12" cy="12" r="4.2" fill="#4285F4" />
  </svg>
);

interface BadgeProps {
  href: string;
  glyph: React.ReactNode;
  kicker: string;
  label: string;
}

const Badge = ({ href, glyph, kicker, label }: BadgeProps) => {
  const live = href.length > 0;
  const content = (
    <>
      <span className="shrink-0">{glyph}</span>
      <span className="text-left leading-tight">
        <span className="block text-[10px] uppercase tracking-widest text-white/55">{kicker}</span>
        <span className="block text-sm font-semibold text-white">{label}</span>
      </span>
    </>
  );

  const base =
    "flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 " +
    "backdrop-blur-md transition-colors";

  if (!live) {
    return (
      <span
        className={cn(base, "cursor-not-allowed opacity-55")}
        title="Link not configured yet"
        aria-disabled="true"
      >
        {content}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(base, "hover:border-white/35 hover:bg-white/[0.08]")}
    >
      {content}
    </a>
  );
};

export const StoreBadges = ({ className }: { className?: string }) => (
  <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
    <Badge href={STORE_LINKS.ios} glyph={<AppleGlyph />} kicker="Download on the" label="App Store" />
    <Badge href={STORE_LINKS.android} glyph={<PlayGlyph />} kicker="Get it on" label="Google Play" />
    <Badge href={STORE_LINKS.chrome} glyph={<ChromeGlyph />} kicker="Add to" label="Chrome" />
  </div>
);

export default StoreBadges;
