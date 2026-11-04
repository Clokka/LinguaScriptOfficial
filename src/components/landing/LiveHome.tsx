// The homepage visitors see, as published from LinguaScript HQ (/hq).
//
//  · nothing published yet (or Supabase slow/unreachable) → LandingPageTest,
//    the built-in test, exactly as before
//  · "single" → one page: a React landing page or a Studio-built page
//  · "test"   → 2–4 arms, sticky per visitor (getVariant), views counted
//  · the app-opening loading screen now lives in SiteIntro (all pages)
//
// Speed: the config is cached on the device; a fresh cache (< 10 min) shows
// instantly, otherwise we wait at most 900 ms. Every page is a lazy chunk
// except the two already in the first load (Landing5, LandingClear).
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import LandingPageTest from "@/components/landing/LandingPageTest";
import Landing5 from "@/pages/Landing5";
import LandingClear from "@/pages/LandingClear";
import { PageLoading } from "@/components/PageLoading";
import { getVariant, track } from "@/lib/experiments";
import { cacheIsFresh, fetchLiveSite, readCache, readPreview, type SiteConfig, type SitePage } from "@/lib/site/config";

const LabLanding = lazy(() => import("@/pages/landing/LabLanding"));
const Landing = lazy(() => import("@/pages/Landing"));
const LandingPage2 = lazy(() => import("@/pages/LandingPage2"));
const LandingPage3 = lazy(() => import("@/pages/LandingPage3"));
const LandingPage4 = lazy(() => import("@/pages/LandingPage4"));
const StudioLanding = lazy(() => import("@/pages/landing/StudioLanding"));

const WAIT_MS = 900;

export function HomePage({ page }: { page: SitePage }) {
  if (page.kind === "studio") return <StudioLanding page={page} />;
  switch (page.page) {
    case "clear": return <LandingClear />;
    case "gold": case "glass": case "split": return <LabLanding theme={page.page} />;
    case "landing": return <Landing />;
    case "v2": return <LandingPage2 />;
    case "v3": return <LandingPage3 />;
    case "v4": return <LandingPage4 />;
    default: return <Landing5 />;
  }
}

export default function LiveHome() {
  const preview = useMemo(() => readPreview(), []);
  const lpPreview = useMemo(() => /[?&]lp=/.test(window.location.search), []);
  const [site, setSite] = useState<SiteConfig | null | undefined>(() => {
    if (preview) return preview;
    if (lpPreview) return null; // ?lp= previews the built-in pages
    const c = readCache();
    return cacheIsFresh(c) ? c!.config : undefined;
  });

  useEffect(() => {
    if (preview || lpPreview) return;
    let settled = false;
    const t = setTimeout(() => { if (!settled) setSite((s) => (s === undefined ? readCache()?.config ?? null : s)); }, WAIT_MS);
    fetchLiveSite()
      .then((c) => { settled = true; setSite((s) => (s === undefined ? c : s)); })
      .catch(() => { settled = true; setSite((s) => (s === undefined ? readCache()?.config ?? null : s)); });
    return () => clearTimeout(t);
  }, [preview, lpPreview]);

  const arm = useMemo(() => {
    if (!site || site.home.mode !== "test") return null;
    const id = getVariant(site.home.key, site.home.arms.map((a) => a.id));
    return site.home.arms.find((a) => a.id === id) ?? site.home.arms[0];
  }, [site]);

  useEffect(() => {
    if (site && site.home.mode === "test" && arm && !preview) void track(site.home.key, "view");
  }, [site, arm, preview]);

  if (site === undefined) return <PageLoading />;

  const page = !site || site.home.mode === "builtin" ? null : site.home.mode === "single" ? site.home.page : arm?.page ?? null;
  return (
    <>
      <Suspense fallback={<PageLoading />}>
        {page ? <HomePage page={page} /> : <LandingPageTest />}
      </Suspense>
    </>
  );
}
