# Prompt: make Google sign-in work and show linguascript.co.uk

Paste everything below the line into Lovable (or a coding session) when you have credits.

---

**Goal:** "Continue with Google" on https://linguascript.co.uk/auth must sign people in, and Google's screen must show **LinguaScript / linguascript.co.uk**, never `ffephracinqeylfhqkiz.supabase.co`. The Chrome extension's sign-in uses the same page (`/auth?ext=1`), so it's blocked until this works.

**How it's set up (don't redesign it, just make it work):**
- The website is hosted on **Cloudflare** (built from GitHub `main` with `npx vite build`). The backend is **Lovable Cloud** (Supabase project `ffephracinqeylfhqkiz`).
- `/auth` shows **Google's own button** (Google Identity Services, `src/lib/googleSignIn.ts`), with OAuth client `83696703346-d088shcldb678oec73jmh3o5lqjru132.apps.googleusercontent.com` (Google Cloud project "test 1", client name "lingua auth consent screen"). Google returns an **ID token** plus our nonce.
- The ID token becomes a session in one of two ways:
  1. `supabase.auth.signInWithIdToken` fails on Lovable Cloud, because Cloud's Google login goes through `oauth.lovable.app`, not Supabase's Google provider.
  2. The **`google-auth` edge function** (`supabase/functions/google-auth/index.ts`) verifies the token (signature, aud, exp, email_verified, nonce), creates the user if new, and returns `{ token_hash, email, v: 2 }`. The site then calls `verifyOtp`. **This function's v2 code was never deployed.** GitHub's deploy workflow has no Supabase token, because Lovable Cloud doesn't give one out. The live copy is older and doesn't return `v: 2`, so the site shows "Google sign-in didn't work this time".
- Backup (in code since PR "fall back to Lovable Cloud's Google login"): if step 2 fails, the site calls `lovable.auth.signInWithOAuth("google", { redirect_uri: <same page> })` (`src/integrations/lovable`). That uses Cloud → Users → Google → **Your own credentials**, already filled in with the client above.

**Please do exactly this:**
1. **Deploy these edge functions from the repo as they are (no code changes):** `google-auth`, `extension-handoff`, `stremio-addon`. Keep `verify_jwt = false` for `stremio-addon` and `google-auth` if `supabase/config.toml` says so (`google-auth` is called before the user has a session). Then call `google-auth` with an empty POST and confirm it answers with a JSON error, not 404.
2. In **Cloud → Users → Google (Your own credentials)**, confirm the Client ID above is saved with a valid secret, and that `https://oauth.lovable.app/callback` is ticked.
3. Tell me to add these to the Google OAuth client "lingua auth consent screen" (Google Cloud Console → APIs & Services → Credentials), if they're missing:
   - Authorized **JavaScript origins:** `https://linguascript.co.uk`, `https://www.linguascript.co.uk`
   - Authorized **redirect URIs:** `https://oauth.lovable.app/callback`
4. In Google Cloud Console → **OAuth consent screen / Branding**, the app name should be **LinguaScript**, the home page `https://linguascript.co.uk`, and `linguascript.co.uk` listed under authorized domains, so Google's screen names LinguaScript.
5. Test: open https://linguascript.co.uk/auth?ext=1 → Continue with Google → you should land signed in. With the Chrome extension 1.7.4+ installed, the tab should close and the video tab should say "✓ Signed in to LinguaScript".

**Don't:** switch the main button back to `supabase.auth.signInWithOAuth` (that shows the supabase.co address); remove the nonce, email_verified or `v: 2` checks; or change the extension.
