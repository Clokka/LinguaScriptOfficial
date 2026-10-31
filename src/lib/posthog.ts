/**
 * PostHog, loaded only after the visitor accepts analytics (src/lib/consent.ts)
 * and only after the page has shown. It used to be in the main bundle, so
 * every visitor downloaded it before seeing anything — even the ones who
 * never accept. Calls made before it finishes loading wait in a short queue;
 * calls made without consent are dropped, exactly as opt-out did before.
 */
import type { PostHog } from "posthog-js";

let client: PostHog | null = null;
let started = false;
const queue: ((p: PostHog) => void)[] = [];
/** Last signed-in user, so consenting mid-visit still links events to them. */
let identity: { id: string; email?: string } | null = null;

export function withPosthog(fn: (p: PostHog) => void) {
  if (client) {
    try { fn(client); } catch { /* never break the app */ }
    return;
  }
  if (!started) return;
  if (queue.length < 200) queue.push(fn);
}

export function identifyUser(id: string, email?: string) {
  identity = { id, email };
  withPosthog((p) => p.identify(id, { email }));
}

export function resetUser() {
  identity = null;
  withPosthog((p) => p.reset());
}

export function loadPosthog() {
  if (started) return;
  started = true;
  // Let the page draw first; analytics can wait a moment.
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
    ?? ((cb: () => void) => window.setTimeout(cb, 1500));
  idle(() => void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init("phc_rMYDUoc4Azeu3Awaf9KLjUmuvdDmPXq2pCSEKJdE9BDS", {
        api_host: "https://eu.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        persistence: "localStorage+cookie",
      });
      posthog.opt_in_capturing();
      client = posthog;
      // Signed in before it loaded → identify first so queued events are theirs.
      if (identity) posthog.identify(identity.id, { email: identity.email });
      for (const fn of queue.splice(0)) {
        try { fn(posthog); } catch { /* never break the app */ }
      }
    })
    .catch(() => { started = false; }));
}

export const posthogStarted = () => started;
