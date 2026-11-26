/** Shared choices for HQ and the safe, non-random homepage fallback. */
export const DEFAULT_HOME_PATH = "/landing6";
export const HOME_PICKS: [string, string][] = [
  ["/landing7", "Minimal: one promise, one button"],
  ["/landing6", "Films you'll understand (fan)"],
  ["/landing5", "Chameleon Method"],
  ["/landing", "Tap-a-word demo"],
  ["/landingpage2", "Product walkthrough"],
  ["/landingpage3", "3D chameleon"],
  ["/landingpage4", "Semantic dark"],
  ["/landing-gold", "Black & gold"],
  ["/landing-glass", "Liquid glass"],
  ["/landing-split", "Black / white split"],
  ["/landing-clear", "Clear page"],
  ["/for-schools", "Schools"],
];

export const LEGACY_HOME_PATHS: Record<string, string> = {
  current: "/landing5", gold: "/landing-gold", glass: "/landing-glass",
  split: "/landing-split", clear: "/landing-clear", landing: "/landing",
  v2: "/landingpage2", v3: "/landingpage3", v4: "/landingpage4",
};

export function homePagePath(page?: { kind: string; path?: string; page?: string }): string {
  return page?.kind === "path" ? page.path ?? "" : LEGACY_HOME_PATHS[page?.page ?? ""] ?? "";
}

export function configuredHomePaths(home?: {
  mode: string; path?: string; page?: Parameters<typeof homePagePath>[0];
  arms?: { page: Parameters<typeof homePagePath>[0] }[];
}): string[] {
  if (!home || home.mode === "builtin") return [DEFAULT_HOME_PATH];
  if (home.mode === "path") return home.path ? [home.path] : [];
  if (home.mode === "single") return [homePagePath(home.page)].filter(Boolean);
  return (home.arms ?? []).map((arm) => homePagePath(arm.page)).filter(Boolean);
}
/** Pages added in HQ with "Add to landing page options" (this browser). Published ones show for the whole team via the site history. */
const SAVED_KEY = "ls.hq.landingOptions";
export function savedHomePaths(): string[] {
  try { const v = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
export function saveHomePath(path: string): string[] {
  const next = Array.from(new Set([...savedHomePaths(), path])).slice(0, 50);
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* private window: it still works for this visit */ }
  return next;
}
