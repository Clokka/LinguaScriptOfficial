// Lets the homepage show ANY page of the site by its address (HQ → "Which page
// is the homepage?" → e.g. /landing). App.tsx hands its route list down here;
// LiveHome renders that list at the chosen address, so the URL stays "/".
import { createContext, useContext, type ReactNode } from "react";

export const HomeRoutesContext = createContext<ReactNode>(null);
export const useHomeRoutes = () => useContext(HomeRoutesContext);

/** Addresses that can never be the homepage (loops, private or app pages). */
const BLOCKED = /^\/(hq|admin|auth|partners|teacher|profile|flashcards|vocabulary|watch|checkout|reset-password|r\/|index$)/i;

/** "landing page 2" / "linguascript.co.uk/landing" / "/Landing/" → "/landing" or null. */
export function cleanHomePath(input: string): string | null {
  let p = (input || "").trim();
  p = p.replace(/^https?:\/\/[^/]+/i, "").replace(/^(www\.)?linguascript\.co\.uk/i, "");
  p = p.split(/[?#]/)[0].trim().replace(/\s+/g, "").toLowerCase();
  if (!p) return null;
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+$/, "");
  if (!p || p === "/" || BLOCKED.test(p) || !/^\/[a-z0-9][a-z0-9\-/]{0,79}$/.test(p)) return null;
  return p;
}
