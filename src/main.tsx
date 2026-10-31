import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initIntegrations } from "./lib/integrations";
import { initAnalytics } from "./lib/analytics";
import { loadPosthog } from "./lib/posthog";

import { getConsent } from "./lib/consent";

// Analytics only after consent (UK GDPR/PECR) — see src/lib/consent.ts.
// PostHog downloads after the page has shown (src/lib/posthog.ts).
if (getConsent() === "granted") {
  initIntegrations();
  loadPosthog();
  initAnalytics();
}

createRoot(document.getElementById("root")!).render(<App />);
