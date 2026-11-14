import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Static "most common words" pages (/words/**, scripts/word-pages.mjs): plain HTML
// written into dist after the app build, so Google reads them without JavaScript
// and Cloudflare's build command stays `npx vite build`.
function wordPages(mode: string): Plugin {
  return {
    name: "linguascript-word-pages",
    apply: "build",
    async closeBundle() {
      const env = loadEnv(mode, process.cwd(), "VITE_");
      const { renderWordPages } = await import("./scripts/word-pages.mjs");
      const paths = renderWordPages(path.resolve(__dirname, "dist"), __dirname, {
        supabaseUrl: env.VITE_SUPABASE_URL, supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
      });
      console.log(`word pages: ${paths.length} written`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger(), wordPages(mode)].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Shared rules for the website, the phone app and future apps (packages/core).
      "@linguascript/core": path.resolve(__dirname, "./packages/core/src"),
    },
  },
}));

