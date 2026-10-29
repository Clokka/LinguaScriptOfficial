import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import posthog from "posthog-js";
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        // Flush any guest-mode flashcards into the freshly signed-in account.
        if (event === "SIGNED_IN" && session?.user) {
          void migrateGuestWords(session.user.id);
          posthog.identify(session.user.id, { email: session.user.email });
          maybeTrackSignup(session.user);
        }
        if (event === "SIGNED_OUT") {
          posthog.reset();
        }
        if (session?.user) void syncTimezone(session.user.id);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    posthog.reset();
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
