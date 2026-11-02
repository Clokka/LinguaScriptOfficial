// Lightweight integrations loader (Microsoft Clarity, etc.)
// Settings live in localStorage so the admin can toggle without a deploy.

export type IntegrationKey = "clarity" | "metaPixel" | "googleAnalytics" | "tiktokPixel" | "linkedinInsight" | "manychat" | "supadata";

export interface IntegrationConfig {
  enabled: boolean;
  id: string;
}

const STORAGE_KEY = "ls.integrations";

const DEFAULTS: Record<IntegrationKey, IntegrationConfig> = {
  clarity: { enabled: true, id: "wrmsg5geae" },
  metaPixel: { enabled: false, id: "" },
  googleAnalytics: { enabled: false, id: "" },
  tiktokPixel: { enabled: false, id: "" },
  linkedinInsight: { enabled: false, id: "" },
  manychat: { enabled: false, id: "" },
  supadata: { enabled: true, id: "" },
};

export function getIntegrations(): Record<IntegrationKey, IntegrationConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveIntegrations(cfg: Record<IntegrationKey, IntegrationConfig>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

const loaded = new Set<string>();

function loadWhenIdle(key: string, src: string) {
  if (loaded.has(key)) return;
  loaded.add(key);
  const go = () => { const t = document.createElement("script"); t.async = true; t.src = src; document.head.appendChild(t); };
  const w = window as any;
  if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 2500);
}

function loadClarity(id: string) {
  const key = `clarity:${id}`;
  if (loaded.has(key) || !id) return;
  loaded.add(key);
  (function (c: any, l: Document, a: string, r: string, i: string) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode!.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
}

export function initIntegrations() {
  if (typeof window === "undefined") return;
  const cfg = getIntegrations();
  if (cfg.clarity.enabled && cfg.clarity.id) loadClarity(cfg.clarity.id);
  // GoAffPro (old affiliate tracker) used to load for every visitor from
  // index.html, before consent. It now loads only after consent, once the
  // page is idle, until the own partner programme (src/lib/referral.ts) has
  // replaced it; then delete this line and src/lib/goaffpro.ts.
  loadWhenIdle("goaffpro", "https://api.goaffpro.com/loader.js?shop=pyqppuomzx");
  // Future: meta pixel, GA, etc.
}
