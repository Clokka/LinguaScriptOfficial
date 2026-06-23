import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initIntegrations } from "./lib/integrations";

initIntegrations();

createRoot(document.getElementById("root")!).render(<App />);
