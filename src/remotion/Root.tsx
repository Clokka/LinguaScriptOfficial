import { Composition } from "remotion";
import { GreenTransition } from "./GreenTransition";

/**
 * Remotion composition registry.
 *
 * Entry point is src/remotion/index.ts. Preview with `npm run video`,
 * render with `npm run video:render`.
 */
export const RemotionRoot = () => (
  <>
    <Composition
      id="GreenTransition"
      component={GreenTransition}
      durationInFrames={210}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* Square cut for social. Same component, different frame. */}
    <Composition
      id="GreenTransitionSquare"
      component={GreenTransition}
      durationInFrames={210}
      fps={30}
      width={1080}
      height={1080}
    />
  </>
);
