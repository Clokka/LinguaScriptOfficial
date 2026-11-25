/** Branded browser sign-in returns only a one-use magic-link hash, never a session. */
export const PHONE_GOOGLE_CALLBACK = 'linguascript://auth-callback';
export const isPhoneGoogleState = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9]{32,128}$/.test(value);

export function phoneGoogleReturn(tokenHash: string, state: string): string {
  if (!isPhoneGoogleState(state) || !/^[a-zA-Z0-9_-]{20,256}$/.test(tokenHash)) {
    throw new Error('Invalid phone sign-in return');
  }
  // Fragment avoids sending the one-use credential in HTTP requests or referrers.
  return `${PHONE_GOOGLE_CALLBACK}#${new URLSearchParams({ token_hash: tokenHash, state })}`;
}

export function readPhoneGoogleReturn(url: string, expectedState: string): string | null {
  if (!isPhoneGoogleState(expectedState)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'linguascript:' || parsed.hostname !== 'auth-callback' ||
        (parsed.pathname !== '' && parsed.pathname !== '/') || parsed.search) return null;
    const params = new URLSearchParams(parsed.hash.slice(1));
    const hash = params.get('token_hash');
    return params.get('state') === expectedState && hash && /^[a-zA-Z0-9_-]{20,256}$/.test(hash) ? hash : null;
  } catch { return null; }
}