import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// configureGoogleSignIn is called from _layout.tsx; keep the export signature.
export function configureGoogleSignIn(): void {
  // Uses expo-web-browser OAuth — no native SDK config needed.
}

export async function signInWithGoogle(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const redirectTo = Linking.createURL('auth-callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data.url) {
      return { ok: false, error: error?.message ?? 'Could not start Google sign-in' };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, error: 'cancelled' };
    }

    if (result.type !== 'success') {
      return { ok: false, error: 'Sign-in window closed unexpectedly' };
    }

    // PKCE: exchange the code in the redirect URL for a session
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (sessionError) return { ok: false, error: sessionError.message };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Google sign-in failed' };
  }
}
