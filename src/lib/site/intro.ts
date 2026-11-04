// When the app-opening loading screen plays. The choice (loader, once per
// visit / first visit / always, auto or button) comes from HQ → Go live and is
// cached on the device; before anything is published the default is
// "Through the languages → LinguaScript", once per visit.
import { DEFAULT_SITE, readCache, readPreview, type SiteConfig } from "@/lib/site/config";

const SEEN_SESSION = "ls.intro.seen";
const SEEN_EVER = "ls.intro.first";

export type Intro = NonNullable<SiteConfig["intro"]>;

/** The intro to play right now, or null. Decided synchronously from the cache so nothing waits on the network. */
export function introToPlay(): { intro: Intro; preview: boolean } | null {
  const preview = readPreview();
  const cfg = preview ?? readCache()?.config ?? null;
  const intro = cfg?.intro ?? DEFAULT_SITE.intro!;
  if (!intro || intro.loader === "none") return null;
  if (preview || intro.when === "always") return { intro, preview: !!preview };
  try {
    if (intro.when === "first" ? localStorage.getItem(SEEN_EVER) : sessionStorage.getItem(SEEN_SESSION)) return null;
  } catch { /* private mode: play it */ }
  return { intro, preview: false };
}

export function markIntroSeen() {
  try { sessionStorage.setItem(SEEN_SESSION, "1"); localStorage.setItem(SEEN_EVER, "1"); } catch { /* ignore */ }
}
