import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import App from "./App.tsx";
import "./index.css";
import { initIntegrations } from "./lib/integrations";
import { initAnalytics } from "./lib/analytics";

initIntegrations();

posthog.init("phc_rMYDUoc4Azeu3Awaf9KLjUmuvdDmPXq2pCSEKJdE9BDS", {
  api_host: "https://eu.i.posthog.com",
  person_profiles: "identified_only",
  capture_pageview: "history_change",
});
initAnalytics();

createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
