import { useEffect, useRef } from "react";
import { setPerson, trackOnce } from "@/lib/analytics";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Signs the website into the same account as the LinguaScript Chrome
 * extension. The extension's site-bridge.js content script answers on
 * window.postMessage:
 *   ← { source: "ls-extension", type: "account", user: { id, email } | null }
 *   ← { source: "ls-extension", type: "handoff", tokenHash }
 * The handoff is a fresh one-time magic-link token from the extension-handoff
 * function, so the site gets its own session. Sharing the extension's refresh
 * token instead would trip Supabase's reuse detection and log both out.
 *
 * Signed out → sign in automatically, unless the learner signed out here on
 * purpose (then we only offer). Signed in as someone else → ask first.
 */
const AUTO_OFF_KEY = "ls.extAutoSignIn";
// The extension pop-up's "Continue with Google" opens /auth?ext=1: once the
// learner is signed in here (Google shows linguascript.co.uk), this tab signs
// the EXTENSION in with a one-time token from extension-handoff (the same
// function the extension uses the other way). Kept in sessionStorage because
// /auth and the Google redirect drop the query string.
const EXT_LOGIN_KEY = "ls.extLoginWanted";
const OFFERED_KEY = "ls.extOfferShown";

type ExtUser = { id: string; email?: string | null };

const post = (type: string) => window.postMessage({ source: "ls-site", type }, window.location.origin);

export function ExtensionAccountSync() {
  const { user, loading } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const switchingRef = useRef(false);
  const extUserRef = useRef<ExtUser | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      try {
        if (event === "SIGNED_OUT" && !switchingRef.current) localStorage.setItem(AUTO_OFF_KEY, "off");
        if (event === "SIGNED_IN") localStorage.removeItem(AUTO_OFF_KEY);
      } catch { /* storage blocked */ }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("ext") === "1") sessionStorage.setItem(EXT_LOGIN_KEY, "1");
    } catch { /* storage blocked */ }
  }, []);

  // Signed in here + the extension asked → sign the extension in.
  useEffect(() => {
    if (loading || !user) return;
    let wanted = false;
    try { wanted = sessionStorage.getItem(EXT_LOGIN_KEY) === "1"; } catch { /* storage blocked */ }
    if (!wanted) return;
    try { sessionStorage.removeItem(EXT_LOGIN_KEY); } catch { /* storage blocked */ }
    void (async () => {
      const { data, error } = await supabase.functions.invoke("extension-handoff", { method: "POST" });
      const tokenHash = (data as { token_hash?: string } | null)?.token_hash;
      if (error || !tokenHash) {
        toast.error("Couldn't sign in the Chrome extension", { description: error?.message ?? "Try again from the extension." });
        return;
      }
      window.postMessage({ source: "ls-site", type: "extension-login", tokenHash }, window.location.origin);
    })();
  }, [loading, user]);

  useEffect(() => {
    const requestHandoff = async () => {
      if (userRef.current) {
        switchingRef.current = true;
        await supabase.auth.signOut();
        switchingRef.current = false;
      }
      post("handoff");
    };

    const offer = (ext: ExtUser, switching: boolean) => {
      try {
        if (sessionStorage.getItem(OFFERED_KEY) === ext.id) return;
        sessionStorage.setItem(OFFERED_KEY, ext.id);
      } catch { /* storage blocked */ }
      toast(switching ? "Your Chrome extension uses another account" : "Sign in with your Chrome extension?", {
        description: `Use ${ext.email ?? "the same account"} here too, so your words and XP match.`,
        duration: 15000,
        action: { label: switching ? "Switch" : "Sign in", onClick: () => void requestHandoff() },
      });
    };

    const decide = () => {
      const ext = extUserRef.current;
      if (!ext || loadingRef.current) return;
      const current = userRef.current;
      if (current?.id === ext.id) return;
      let autoOff = false;
      try { autoOff = localStorage.getItem(AUTO_OFF_KEY) === "off"; } catch { /* storage blocked */ }
      if (!current && !autoOff) post("handoff");
      else offer(ext, !!current);
    };

    const onMessage = async (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const data = e.data;
      if (!data || data.source !== "ls-extension") return;
      if (data.type === "ready") {
        post("hello");
        // The extension is installed in this browser.
        trackOnce("extension_connected");
        setPerson({ has_extension: true });
      }
      else if (data.type === "extension-login") {
        if (data.ok) toast.success("Your Chrome extension is signed in", { description: "You can close this tab and go back to your video." });
        else toast.error("Couldn't sign in the Chrome extension", { description: String(data.error ?? "") });
      }
      else if (data.type === "account") {
        extUserRef.current = data.user ?? null;
        decide();
      } else if (data.type === "handoff") {
        if (!data.tokenHash) {
          if (data.error) toast.error("Couldn't sign in from the extension", { description: String(data.error) });
          return;
        }
        const { error } = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: "magiclink" });
        if (error) toast.error("Couldn't sign in from the extension", { description: error.message });
        else toast.success(`Signed in as ${extUserRef.current?.email ?? "your extension account"}`);
      }
    };

    window.addEventListener("message", onMessage);
    post("hello");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Auth finished loading (or changed): re-check against the extension's account.
  useEffect(() => {
    if (!loading) post("hello");
  }, [loading, user?.id]);

  return null;
}
