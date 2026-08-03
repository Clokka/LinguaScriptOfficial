import { Config } from "@remotion/cli/config";
import path from "path";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

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
