import { Composition } from "remotion";
import { GreenTransition } from "./GreenTransition";
import { HedgehogGiveaway } from "./HedgehogGiveaway";
import { Chameleon3DSmokeTest } from "./Chameleon3DSmokeTest";
import { FeatureShowcase } from "./FeatureShowcase";
import { VideoDecodeTest } from "./VideoDecodeTest";

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

    {/* Instagram story — 9:16. */}
    <Composition
      id="HedgehogGiveaway"
      component={HedgehogGiveaway}
      durationInFrames={270}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* Throwaway: validates the 3D chameleon pipeline renders in this
        environment before it's wired into the full FeatureShowcase reel. */}
    <Composition
      id="Chameleon3DSmokeTest"
      component={Chameleon3DSmokeTest}
      durationInFrames={90}
      fps={30}
      width={720}
      height={720}
    />

    {/* Hand-timed proof-of-concept reel for socials — the "save a word ->
        review -> level up" loop, real UI throughout, no 3D (see
        Chameleon3D.tsx STATUS note). 900 frames @ 30fps = 30s. */}
    <Composition
      id="FeatureShowcase"
      component={FeatureShowcase}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* Throwaway: confirms the uploaded HEVC phone clip decodes. */}
    <Composition
      id="VideoDecodeTest"
      component={VideoDecodeTest}
      durationInFrames={216}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
