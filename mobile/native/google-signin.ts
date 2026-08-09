import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ffephracinqeylfhqkiz.supabase.co';

export function configureGoogleSignIn(): void {
  if (!WEB_CLIENT_ID) {
    console.warn('[GoogleSignIn] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — Google Sign-In unavailable');
    return;
  }
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
}

// Exchange a Google ID token for a Supabase session via our edge function.
// This bypasses the need to configure Google as an OAuth provider in Supabase.
async function signInWithGoogleIdToken(idToken: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/google-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? 'Google auth failed' };

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: data.email,
      token: data.token_hash,
      type: 'magiclink',
    });

    if (verifyError) return { ok: false, error: verifyError.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Google auth request failed' };
  }
}

// Native sign-in using @react-native-google-signin (shows the system sheet in-app).
// Falls back to expo-web-browser OAuth only when the Web Client ID is not configured.
export async function signInWithGoogle(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  // ── Native path (preferred) ───────────────────────────────────────
  if (WEB_CLIENT_ID) {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (!isSuccessResponse(response)) {
        return { ok: false, error: 'cancelled' };
      }

      const idToken = response.data.idToken;
      if (!idToken) {
        return { ok: false, error: 'Google did not return an ID token' };
      }

      return signInWithGoogleIdToken(idToken);
    } catch (e: any) {
      if (isErrorWithCode(e)) {
        if (
          e.code === statusCodes.SIGN_IN_CANCELLED ||
          e.code === statusCodes.SIGN_IN_REQUIRED
        ) {
          return { ok: false, error: 'cancelled' };
        }
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          return { ok: false, error: 'Google Play Services not available on this device' };
        }
        if (e.code === statusCodes.IN_PROGRESS) {
          return { ok: false, error: 'cancelled' };
        }
      }
      return { ok: false, error: e?.message ?? 'Google sign-in failed' };
    }
  }

  // ── WebBrowser fallback (when client ID not set) ──────────────────
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
      return { ok: false, error: 'Sign-in window closed' };
    }
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (sessionError) return { ok: false, error: sessionError.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Google sign-in failed' };
  }
}
