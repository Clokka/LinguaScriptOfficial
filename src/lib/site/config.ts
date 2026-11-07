// What the live website shows, as chosen in LinguaScript HQ (/hq).
// HQ writes a config with publish_site(); the homepage reads get_live_site().
// Every value is checked against these lists before use, so a config can only
// CHOOSE designs (never inject HTML). Kept tiny: it is in the first load.
import { supabase } from "@/integrations/supabase/client";

export const REACT_PAGES = {
  current: "Chameleon Method homepage",
  gold: "Lab page · Black & gold",
  glass: "Lab page · Liquid glass",
  split: "Lab page · Black / white split",
  clear: "Clear page",
  landing: "Tap-a-word demo page",
  v2: "Product walkthrough page",
  v3: "3D chameleon page",
  v4: "Semantic dark page",
} as const;
export type ReactPageId = keyof typeof REACT_PAGES;

export const BUILT_IN_LOADERS = {
  none: "No intro",
  languages: "Through the languages → LinguaScript",
  decode: "Decoding text",
  deck: "Deck colours drop in",
} as const;
export const LOADER_LABS = ["loading-experiences", "loading-screens", "loading-motion"] as const;
export const PAGE_LOADERS = { skeleton: "Grey skeleton (fastest)", brand: "Chameleon + colour word" } as const;

export type StudioSection = { id: string; variant?: string; lab?: string; element?: number };
export type SitePage = { kind: "react"; page: ReactPageId } | { kind: "studio"; theme: string; sections: StudioSection[] };
export type SiteArm = { id: string; name: string; page: SitePage };
export type SiteConfig = {
  version: 2;
  /** builtin = the homepage test that ships in the code (LandingPageTest). */
  home: { mode: "builtin" } | { mode: "single"; page: SitePage } | { mode: "test"; key: string; arms: SiteArm[] };
  intro?: { loader: string; when: "session" | "first" | "always"; end: "auto" | "button" };
  pageLoader?: keyof typeof PAGE_LOADERS;
  /** Video player while subtitles load: one design per film from `designs`,
   * then one "loading → playing" motion from `reveals` (empty = straight in). */
  filmLoader?: FilmLoaderConfig;
  published_id?: number;
  published_at?: string;
};

export type FilmLoaderConfig = { designs: string[]; reveals: string[] };
/** Defaults until HQ publishes others. Reveals are Rowan's favourite loading → playing motions. */
export const DEFAULT_FILM_LOADER: FilmLoaderConfig = {
  // One story, in order: reading the SRT file, the three steps, the chameleon colouring the words,
  // then (when the subtitles are ready) the green colour-wash curtain sweeps across into the film.
  // lab ids are 0-based tile numbers: loading-screens #052 SRT timecodes scroll (Glass) = 51,
  // #072 Progress steps (Glass) = 71, #002 Chameleon colour cycle (Glass) = 1; loading-motion "Colour wash" = 3.
  designs: ["lab:loading-screens:51", "lab:loading-screens:71", "lab:loading-screens:1"],
  reveals: ["lab:loading-motion:3"],
};
export const isFilmDesign = (v: unknown): v is string =>
  v === "chameleon" || (typeof v === "string" && /^decode:(languages|decode|deck)$/.test(v)) || (typeof v === "string" && /^lab:(loading-screens|loading-experiences):\d{1,3}$/.test(v));
export const isFilmReveal = (v: unknown): v is string => typeof v === "string" && /^lab:loading-motion:\d{1,3}$/.test(v);
function cleanFilm(f: any): FilmLoaderConfig | undefined {
  if (!f || typeof f !== "object") return undefined;
  const designs = (Array.isArray(f.designs) ? f.designs : []).filter(isFilmDesign).slice(0, 30);
  const reveals = (Array.isArray(f.reveals) ? f.reveals : []).filter(isFilmReveal).slice(0, 30);
  return designs.length ? { designs, reveals } : undefined;
}
/** What the video player uses now (cached config, else the defaults). */
export function getFilmLoader(): FilmLoaderConfig {
  const c = readCache();
  if (!cacheIsFresh(c)) void fetchLiveSite().catch(() => {}); // next film uses the newest
  return c?.config?.filmLoader ?? DEFAULT_FILM_LOADER;
}

export const isLoaderId = (v: unknown): v is string =>
  typeof v === "string" &&
  (v in BUILT_IN_LOADERS || /^lab:(loading-experiences|loading-screens|loading-motion):\d{1,3}$/.test(v));

function validPage(p: any): p is SitePage {
  if (!p || typeof p !== "object") return false;
  if (p.kind === "react") return typeof p.page === "string" && p.page in REACT_PAGES;
  return p.kind === "studio" && typeof p.theme === "string" && Array.isArray(p.sections) && p.sections.length <= 40;
}

/** Returns a safe config, or null when it doesn't look like one we can show. */
export function cleanConfig(c: any): SiteConfig | null {
  if (!c || c.version !== 2 || !c.home) return null;
  const h = c.home;
  if (h.mode === "single" && !validPage(h.page)) return null;
  if (h.mode === "test") {
    if (!/^[a-z0-9_]{3,40}$/.test(h.key) || !Array.isArray(h.arms) || h.arms.length < 2 || h.arms.length > 4) return null;
    if (!h.arms.every((a: any) => /^[a-z0-9]{1,12}$/.test(a?.id) && validPage(a.page))) return null;
  }
  if (h.mode !== "single" && h.mode !== "test" && h.mode !== "builtin") return null;
  const intro = c.intro && isLoaderId(c.intro.loader) ? {
    loader: c.intro.loader,
    when: ["session", "first", "always"].includes(c.intro.when) ? c.intro.when : "session",
    end: c.intro.end === "button" ? "button" : "auto",
  } : undefined;
  return { ...c, intro, pageLoader: c.pageLoader === "brand" ? "brand" : "skeleton", filmLoader: cleanFilm(c.filmLoader) } as SiteConfig;
}

const CACHE = "ls.site.live.v1";
const PREVIEW = "ls.site.preview.v1";
export const PAGE_LOADER_KEY = "ls.site.pageLoader";
const FRESH_MS = 10 * 60 * 1000;

type Cached = { at: number; config: SiteConfig | null };
export function readCache(): Cached | null {
  try { const c = JSON.parse(localStorage.getItem(CACHE) || "null"); return c && typeof c.at === "number" ? c : null; } catch { return null; }
}
export function writeCache(config: SiteConfig | null) {
  try {
    localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), config }));
    localStorage.setItem(PAGE_LOADER_KEY, config?.pageLoader ?? "skeleton");
  } catch { /* private mode */ }
}
export const cacheIsFresh = (c: Cached | null) => !!c && Date.now() - c.at < FRESH_MS;

export async function fetchLiveSite(): Promise<SiteConfig | null> {
  const { data, error } = await (supabase as any).rpc("get_live_site");
  if (error) throw error;
  const config = cleanConfig(data);
  writeCache(config);
  return config;
}

/** HQ "Preview" opens /?sitepreview=1 after storing the draft config here. */
export function readPreview(): SiteConfig | null {
  if (!/[?&]sitepreview=1/.test(window.location.search)) return null;
  try { return cleanConfig(JSON.parse(localStorage.getItem(PREVIEW) || "null")); } catch { return null; }
}
export function writePreview(config: SiteConfig) {
  try { localStorage.setItem(PREVIEW, JSON.stringify(config)); } catch { /* ignore */ }
}

/** Visitor-facing routes a design's buttons may open (anything else is ignored). */
export const SAFE_ROUTES = ["/onboarding", "/auth", "/pricing", "/the-chameleon-method", "/frequent-words",
  "/blog", "/privacy", "/terms", "/browse", "/demo"];
export function routeForText(text: string): string | null {
  const t = text.trim().slice(0, 60);
  if (!t) return null;
  if (/log ?in|sign ?in/i.test(t)) return "/auth";
  if (/pric|plans?\b|upgrade|\bpro\b/i.test(t)) return "/pricing";
  if (/demo/i.test(t)) return "/demo";
  if (/method/i.test(t)) return "/the-chameleon-method";
  if (/privacy/i.test(t)) return "/privacy";
  if (/terms/i.test(t)) return "/terms";
  if (/blog/i.test(t)) return "/blog";
  if (/^films?$|browse|discover/i.test(t)) return "/browse";
  if (/frequen|most common|top 3,?000/i.test(t)) return "/frequent-words";
  return null;
}

export const DEFAULT_SITE: SiteConfig = {
  version: 2,
  home: { mode: "builtin" },
  intro: { loader: "languages", when: "session", end: "auto" },
  pageLoader: "skeleton",
  filmLoader: DEFAULT_FILM_LOADER,
};

/** Studio Builder state (theme + sections with on/off) → a publishable page. */
export function studioToPage(c: { theme: string; sections: { id: string; v?: string; lab?: string; n?: number; on?: boolean }[] }): SitePage {
  return {
    kind: "studio",
    theme: c.theme,
    sections: c.sections.filter((s) => s.on !== false).map((s) =>
      s.id === "lib" ? { id: "lib", lab: s.lab, element: s.n } : { id: s.id, variant: s.v }),
  };
}

/** One line describing a page, for HQ. */
export function describePage(p: SitePage): string {
  if (p.kind === "react") return REACT_PAGES[p.page] ?? p.page;
  const libs = p.sections.filter((s) => s.id === "lib").length;
  return `Studio page · ${p.theme} · ${p.sections.length} sections${libs ? ` (${libs} from the library)` : ""}`;
}
export function describeLoader(id: string | undefined): string {
  if (!id || id === "none") return "No intro";
  if (id === "chameleon") return "Chameleon Method screen";
  if (id.startsWith("decode:")) return `Decode · ${id.slice(7)}`;
  if (id in BUILT_IN_LOADERS) return BUILT_IN_LOADERS[id as keyof typeof BUILT_IN_LOADERS];
  const [, lab, n] = id.split(":");
  return `${lab.replace("loading-", "Loading ").replace("-", " ")} #${Number(n) + 1}`;
}
