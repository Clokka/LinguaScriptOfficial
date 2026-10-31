import { useSyncExternalStore } from "react";
import { User, Session } from "@supabase/supabase-js";
import { identifyUser, resetUser } from "@/lib/posthog";
import { supabase } from "@/integrations/supabase/client";
import { migrateGuestWords } from "@/lib/guestWords";
import { syncTimezone } from "@/lib/syncTimezone";
import { track } from "@/lib/analytics";

/**
 * signed_up: the first sign-in of an account created in the last day (covers
 * email confirmation and Google). Many components use this hook, so a
 * per-account flag stops it firing more than once.
 */
function maybeTrackSignup(user: User) {
  try {
    const key = `ls.signedUp.${user.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    const ageMs = Date.now() - Date.parse(user.created_at || "");
    if (ageMs >= 0 && ageMs < 24 * 3600_000) {
      track("signed_up", { method: String(user.app_metadata?.provider || "email") });
    }
  } catch { /* never break auth */ }
}

interface AuthState { user: User | null; session: Session | null; loading: boolean }

// One shared sign-in state for the whole app. Each of the ~50 components that
// call useAuth used to start its own check (all "loading" again on every new
// page) and its own listener, so sign-in side jobs ran once per component.
let state: AuthState = { user: null, session: null, loading: true };
const listeners = new Set<() => void>();
let started = false;

function publish(session: Session | null) {
  state = { session, user: session?.user ?? null, loading: false };
  listeners.forEach((l) => l());
}

function start() {
  if (started) return;
  started = true;
  supabase.auth.onAuthStateChange((event, session) => {
    publish(session);
    // Flush any guest-mode flashcards into the freshly signed-in account.
    if (event === "SIGNED_IN" && session?.user) {
      void migrateGuestWords(session.user.id);
      identifyUser(session.user.id, session.user.email);
      maybeTrackSignup(session.user);
    }
    if (event === "SIGNED_OUT") {
      resetUser();
    }
    if (session?.user) void syncTimezone(session.user.id);
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    publish(session);
    if (session?.user) {
      identifyUser(session.user.id, session.user.email);
    }
  }).catch(() => publish(state.session));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
const snapshot = () => state;

export function useAuth() {
  start();
  const { user, session, loading } = useSyncExternalStore(subscribe, snapshot);

  const signOut = async () => {
    resetUser();
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
