import { useEffect, useRef } from "react";
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
      if (data.type === "ready") post("hello");
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
