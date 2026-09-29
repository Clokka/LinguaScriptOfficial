import { Config } from "@remotion/cli/config";
import path from "path";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// JPEG-captured frames default to full-range colour (yuvj420p), which a lot
// of phone/app video players handle badly — stutter, colour glitches, or an
// outright crash on decode. Force the standard limited-range format and a
// normal HD colour space so renders play back reliably everywhere, not just
// in a desktop browser.
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");

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
