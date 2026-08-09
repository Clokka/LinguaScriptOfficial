import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const resolved = useRef(false);

  const resolve = (s: Session | null) => {
    if (resolved.current) return;
    resolved.current = true;
    setSession(s);
    setUser(s?.user ?? null);
    setLoading(false);
  };

  useEffect(() => {
    // Safety net: never stay loading longer than 5 seconds.
    // Without this, a slow network or AsyncStorage hiccup causes the
    // infinite spinner the user sees on first launch.
    const timeout = setTimeout(() => resolve(null), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        clearTimeout(timeout);
        resolve(session);
        // Keep session/user in sync after the first resolution.
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timeout);
        resolve(session);
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(null);
      });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
