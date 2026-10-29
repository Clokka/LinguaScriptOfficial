import type React from "react";
import { Composition } from "remotion";
import { GreenTransition } from "./GreenTransition";
import { HedgehogGiveaway } from "./HedgehogGiveaway";
import { LaunchReel, LAUNCH_REEL_DURATION } from "./LaunchReel";
import { PromoStory, FEATURE_DURATION, ALL_DURATION, type StoryId } from "./promo/stories";
import { PACKS } from "./promo/pack";
import { FORMATS, THEMES } from "./promo/theme";

/**
 * Promo kit: every story × style × format × language pack.
 * id = Promo-<story>-<style>-<format>-<pack>, e.g. Promo-all-midnight-vertical-en-fr.
 * Render one: npx remotion render src/remotion/index.ts Promo-watch-jungle-vertical-en-fr out/x.mp4
 */
const STORIES: StoryId[] = ["all", "watch", "web", "phone", "gold"];
const PromoCompositions = () => (
  <>
    {PACKS.flatMap((pack) => STORIES.flatMap((story) => THEMES.flatMap((theme) => FORMATS.map((f) => (
      <Composition
        key={`${story}-${theme.id}-${f.id}-${pack.id}`}
        id={`Promo-${story}-${theme.id}-${f.id}-${pack.id}`}
        component={PromoStory as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={story === "all" ? ALL_DURATION : FEATURE_DURATION}
        fps={30}
        width={f.width}
        height={f.height}
        defaultProps={{ story, theme, pack, format: f.id }}
      />
    )))))}
  </>
);

/**
 * Remotion composition registry.
 *
 * Entry point is src/remotion/index.ts. Preview with `npm run video`,
 * render with `npm run video:render`.
 */
export const RemotionRoot = () => (
  <>
    <PromoCompositions />
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

    {/* Chrome extension launch reel — one composition per demographic/language
        cut. Same timeline and animation code throughout; only the on-screen
        sentence, platforms, and flashcards change (see LaunchReel.tsx's
        CONTENT table). */}
    <Composition
      id="LaunchReel-French"
      component={LaunchReel}
      durationInFrames={LAUNCH_REEL_DURATION}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ lang: "fr" }}
    />
    <Composition
      id="LaunchReel-Spanish"
      component={LaunchReel}
      durationInFrames={LAUNCH_REEL_DURATION}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ lang: "es" }}
    />
    <Composition
      id="LaunchReel-Japanese"
      component={LaunchReel}
      durationInFrames={LAUNCH_REEL_DURATION}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ lang: "ja" }}
    />
  </>
);
