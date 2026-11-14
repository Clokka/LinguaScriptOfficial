// "Sign in with Google" using Google's own button (Google Identity Services).
// Why: the old flow sends people to Google from Supabase's address, so Google's
// screen says "continue to <project>.supabase.co". With this button the sign-in
// starts on linguascript.co.uk, so Google shows our domain.
//
// Flow: Google button → ID token (with our nonce) →
//   1. supabase.auth.signInWithIdToken (works when Supabase's Google provider
//      accepts this client ID), else
//   2. google-auth edge function (verifies the token itself, incl. email_verified
//      and nonce) → magic-link token_hash → supabase.auth.verifyOtp.
// The old redirect button stays as the fallback (and is the only option inside
// the phone app and the Lovable editor preview).
import { supabase } from "@/integrations/supabase/client";

/** Public OAuth client ID (Google Cloud project "test 1"); same one google-auth checks. */
export const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  "83696703346-d088shcldb678oec73jmh3o5lqjru132.apps.googleusercontent.com";

/** Origins listed as "Authorized JavaScript origins" on that client in Google Cloud. */
const ORIGINS = ["https://linguascript.co.uk", "https://www.linguascript.co.uk"];

/** Use Google's button only where Google allows it and a popup can open. */
export function canUseGoogleButton(): boolean {
  try {
    if (window.top !== window.self) return false; // editor preview / iframes
    if ((window as any).ReactNativeWebView) return false; // phone app WebView
    if (localStorage.getItem("ls.googleButton") === "0") return false; // kill switch
    if (localStorage.getItem("ls.googleButton") === "1") return true; // testing elsewhere
    return ORIGINS.includes(window.location.origin);
  } catch { return false; }
}

let gisPromise: Promise<any> | null = null;
/** Loads Google's script once, only on the login page. */
export function loadGoogleScript(timeoutMs = 6000): Promise<any> {
  if ((window as any).google?.accounts?.id) return Promise.resolve((window as any).google);
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Google sign-in took too long to load")), timeoutMs);
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => { clearTimeout(timer); (window as any).google?.accounts?.id ? resolve((window as any).google) : reject(new Error("Google sign-in unavailable")); };
      s.onerror = () => { clearTimeout(timer); reject(new Error("Google sign-in blocked")); };
      document.head.appendChild(s);
    }).catch((e) => { gisPromise = null; throw e; });
  }
  return gisPromise;
}

/** A fresh nonce: Google gets the SHA-256 (hex), we keep the raw value to prove it. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

/** Turns Google's ID token into a LinguaScript session. Throws a friendly error. */
export async function signInWithGoogleCredential(idToken: string, rawNonce: string): Promise<void> {
  const direct = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: rawNonce });
  if (!direct.error && direct.data?.session) return;

  const { data, error } = await supabase.functions.invoke("google-auth", { body: { id_token: idToken, nonce: rawNonce } });
  const tokenHash = (data as any)?.token_hash as string | undefined;
  // Only the fixed function (v2: checks email_verified + nonce) may sign people in.
  if (error || !tokenHash || (data as any)?.v !== 2) throw new Error("Google sign-in didn't work this time. Please use the other Google button below.");
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (otpError) throw new Error("Google sign-in didn't work this time. Please use the other Google button below.");
}
