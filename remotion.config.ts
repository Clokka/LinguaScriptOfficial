import { Config } from "@remotion/cli/config";
import path from "path";

// PNG (lossless) intermediate frames — JPEG was baking its own compression
// artifacts into every frame before the H.264 encode ever saw them, on top
// of whatever the encoder itself introduced. Slower to render, but this is
// marketing video, not a live feed, and correctness beats render time here.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// The previous JPEG capture also defaulted ffmpeg to full-range colour
// (yuvj420p), which a lot of phone/app video players handle badly —
// stutter, colour glitches, or an outright crash on decode. Force the
// standard limited-range format and a normal HD colour space so renders
// play back reliably everywhere, not just in a desktop browser.
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
// Default CRF (23) was starving text-and-gradient content of bitrate —
// exactly the content this reel is full of — producing visible macroblock
// "flashing" during fades and other motion. Lower CRF = higher quality/
// bitrate; 16 is close to visually lossless for 1080p.
Config.setCrf(16);

// Remotion bundles with its own webpack, so the Vite "@/..." alias has to be
// re-declared here or every shared component import fails to resolve.
Config.overrideWebpackConfig((current) => ({
  ...current,
  resolve: {
    ...current.resolve,
    alias: {
      ...(current.resolve?.alias ?? {}),
      "@": path.join(process.cwd(), "src"),
    },
  },
}));
