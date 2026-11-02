// Loads the Studio kit (public/brand/studio-kit.js + .css) once, only when the
// published homepage or intro loader actually uses a Studio design.
export type LSKit = {
  renderLive: (root: HTMLElement, page: unknown) => void;
  stopLive: () => void;
  playLoader: (host: HTMLElement, variant: string, opts?: Record<string, unknown>) => void;
  THEMES: [string, string, string][];
  META: Record<string, [string, Record<string, string>]>;
  LAB_NAMES: Record<string, string>;
};
declare global { interface Window { LSKit?: LSKit } }

let loading: Promise<LSKit> | null = null;

function addOnce(tag: "link" | "script", url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attr = tag === "link" ? "href" : "src";
    if (document.querySelector(`${tag}[${attr}="${url}"]`)) return resolve();
    const el = document.createElement(tag);
    if (tag === "link") { (el as HTMLLinkElement).rel = "stylesheet"; (el as HTMLLinkElement).href = url; }
    else { (el as HTMLScriptElement).src = url; (el as HTMLScriptElement).async = true; }
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.appendChild(el);
  });
}

export function loadKit(): Promise<LSKit> {
  if (window.LSKit) return Promise.resolve(window.LSKit);
  if (!loading) {
    void addOnce("link", "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500;700&display=swap").catch(() => {});
    loading = Promise.all([addOnce("link", "/brand/studio-kit.css"), addOnce("script", "/brand/studio-kit.js")])
      .then(() => { if (!window.LSKit) throw new Error("Studio kit missing"); return window.LSKit; })
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}
