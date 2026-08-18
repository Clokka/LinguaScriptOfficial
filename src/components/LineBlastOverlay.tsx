import { cn } from "@/lib/utils";

/**
 * The Line Blast celebration layer — praise, floating XP, and the combo glow.
 *
 * This is the part of the effect people remember, and it existed in four
 * separate copies before this component: the landing demo, the player, a
 * hand-rolled duplicate wired into LinguaScript sessions, and the chameleon
 * demo. They had already drifted — different praise wording, different ambers,
 * different confetti spreads, one of them building DOM through innerHTML. The
 * motion primitives were shared in `lib/lineBlast.ts`; the *presentation* was
 * not, which is exactly the half a viewer actually sees.
 *
 * The keyframes live here rather than in a global stylesheet so the animation
 * travels with the markup that depends on it. Duplicate <style> blocks across
 * instances are harmless — identical rules, and only one blast runs at a time.
 */

/** Where the celebration is anchored. The effect is identical; only the
 *  geometry differs, because the three surfaces have different shapes. */
export type BlastPlacement =
  /** Inside a video-frame-sized relative container (the landing demo). */
  | "stage"
  /** Above a subtitle line in the player — a short, wide box. */
  | "inline"
  /** Viewport-centred, for full-page surfaces like a LinguaScript session. */
  | "screen";

export interface BlastPraise {
  big: string;
  sub: string;
  /** Drives the type size — bigger combos shout louder. */
  combo: number;
  /** Changing this re-triggers the animation. */
  key: number;
}

export interface BlastFloatXp {
  text: string;
  key: number;
}

interface LineBlastOverlayProps {
  praise: BlastPraise | null;
  floatXp: BlastFloatXp | null;
  /** Non-zero fires the edge glow; bump it to re-trigger. */
  glowKey?: number;
  placement?: BlastPlacement;
}

const PRAISE_POS: Record<BlastPlacement, string> = {
  stage: "absolute inset-x-0 top-[28%] z-50",
  inline: "absolute inset-x-0 -top-20 z-50",
  screen: "fixed inset-x-0 top-1/2 -translate-y-1/2 z-50",
};

const XP_POS: Record<BlastPlacement, string> = {
  stage: "absolute bottom-[26%] left-1/2 z-50",
  inline: "absolute -top-8 left-1/2 z-50",
  screen: "fixed bottom-1/3 left-1/2 z-50",
};

// The player's container is the subtitle box itself, not the whole frame, so an
// inset shadow on it would ring the text rather than the video. Bleeding the
// glow outward keeps it reading as a flash of light behind the line.
const GLOW_POS: Record<BlastPlacement, string> = {
  stage: "absolute inset-0 z-[35] rounded-2xl [box-shadow:inset_0_0_90px_rgba(52,211,153,0.55)]",
  inline:
    "absolute -inset-x-10 -inset-y-8 z-[35] rounded-[2rem] [box-shadow:inset_0_0_60px_rgba(52,211,153,0.45)]",
  screen: "fixed inset-0 z-[35] [box-shadow:inset_0_0_90px_rgba(52,211,153,0.55)]",
};

export const LineBlastOverlay = ({
  praise,
  floatXp,
  glowKey = 0,
  placement = "stage",
}: LineBlastOverlayProps) => (
  <>
    <style>{`
      @keyframes lb-praise-in {
        0% { opacity: 0; transform: scale(0.4); }
        12% { opacity: 1; transform: scale(1.12); }
        20% { transform: scale(1); }
        78% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.04) translateY(-14px); }
      }
      @keyframes lb-xp-rise {
        0% { opacity: 0; transform: translate(-50%, 10px); }
        18% { opacity: 1; }
        75% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -48px); }
      }
      @keyframes lb-glow {
        0% { opacity: 0; } 22% { opacity: 1; } 100% { opacity: 0; }
      }
    `}</style>

    {glowKey > 0 && (
      <div
        key={`lb-glow-${glowKey}`}
        aria-hidden="true"
        className={cn("pointer-events-none opacity-0", GLOW_POS[placement])}
        style={{ animation: "lb-glow 0.9s ease-out forwards" }}
      />
    )}

    {praise && praise.big && (
      <div
        key={`lb-praise-${praise.key}`}
        className={cn(
          "pointer-events-none flex flex-col items-center gap-1 opacity-0",
          PRAISE_POS[placement],
        )}
        style={{ animation: "lb-praise-in 1.5s cubic-bezier(0.16,1,0.3,1) forwards" }}
      >
        <div
          className="text-center font-black italic leading-none tracking-tight text-amber-400 [transform:skewX(-6deg)] [text-shadow:0_2px_0_rgba(0,0,0,0.35),0_0_34px_rgba(251,191,36,0.5)]"
          style={{
            fontSize: `clamp(${22 + praise.combo * 4}px, ${3 + praise.combo * 1.2}vw, ${
              36 + praise.combo * 12
            }px)`,
          }}
        >
          {praise.big}
        </div>
        {praise.sub && (
          <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-300 [text-shadow:0_0_16px_rgba(52,211,153,0.6)]">
            {praise.sub}
          </div>
        )}
      </div>
    )}

    {floatXp && (
      <div
        key={`lb-xp-${floatXp.key}`}
        className={cn(
          "pointer-events-none text-base font-extrabold tabular-nums text-emerald-400 opacity-0 [text-shadow:0_0_14px_rgba(52,211,153,0.7)]",
          XP_POS[placement],
        )}
        style={{ animation: "lb-xp-rise 1.3s ease-out forwards" }}
      >
        {floatXp.text}
      </div>
    )}
  </>
);

export default LineBlastOverlay;
