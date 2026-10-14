import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { migrateGuestWords } from "@/lib/guestWords";
import { syncTimezone } from "@/lib/syncTimezone";
import { clearLearnerDeviceState, noteSignedInUser } from "@/lib/deviceLearnerState";

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
        }
        if (session?.user) {
          void syncTimezone(session.user.id);
          noteSignedInUser(session.user.id);
        }
        // The next person on this browser must not inherit this learner's
        // language or onboarding answers.
        if (event === "SIGNED_OUT") clearLearnerDeviceState();
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
