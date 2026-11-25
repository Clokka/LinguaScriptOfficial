// One rule for the app's "welcome" pop-ups (DailyBriefing streak card,
// InterestsPromptModal, …):
//   1. Only ONE at a time. They used to open together on sign-in and stack
//      ("Welcome back" streak card on top of "Help us personalise").
//      Earlier claims win; the others wait and appear after it closes.
//   2. Never on sign-in / setup / team pages, and never in a tab the Chrome
//      extension opened to sign in (/auth?ext=1): that tab closes and the
//      learner goes straight back to their video.
import { useSyncExternalStore } from "react";

const QUIET_PAGES = /^\/(auth|onboarding|reset-password|hq|partners|admin|teacher|for-schools|schools)(\/|$)/;
const EXT_TAB_KEY = "ls.extSignInTab";

/** Called when a page is opened with ?ext=1 (ExtensionAccountSync). */
export function markExtensionSignInTab() {
  try { sessionStorage.setItem(EXT_TAB_KEY, "1"); } catch { /* storage blocked */ }
}

function isExtensionSignInTab(): boolean {
  try {
    return sessionStorage.getItem(EXT_TAB_KEY) === "1" || new URLSearchParams(window.location.search).get("ext") === "1";
  } catch { return false; }
}

/** May a welcome pop-up show on this page at all? */
export function popupsAllowed(pathname: string): boolean {
  return !QUIET_PAGES.test(pathname) && !isExtensionSignInTab();
}

// ── One at a time ─────────────────────────────────────────────────────────────
let current: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Ask to be the pop-up on screen. True if it's yours (or already was). */
export function claimPopup(id: string): boolean {
  if (current && current !== id) return false;
  if (current !== id) { current = id; emit(); }
  return true;
}

/** Give the screen back (on close or unmount) so the next pop-up can show. */
export function releasePopup(id: string) {
  if (current === id) { current = null; emit(); }
}

/** The pop-up currently on screen, if any (re-renders when it changes). */
export function useCurrentPopup(): string | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => current,
    () => null,
  );
}
