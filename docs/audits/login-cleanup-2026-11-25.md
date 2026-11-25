# Login clean-up — audit, plan and prompt (25 Nov 2026)

Scope: **only login** on the new backend (`wxlvxkeqhdlknthmliql`): email + password, password-reset emails, Google. No other emails or features.

## 1. Audit

| Area | Finding | Severity |
|---|---|---|
| Email + password sign-in | Works (tested: sign-up → straight in, wrong password → clear message, 20 s timeout) | ✅ |
| Sign-up | Works; email confirmation is OFF (no email sender) so accounts open at once | ✅ (by design for now) |
| **Password-reset emails** | **Not delivered to learners.** No SMTP and no email hook: Supabase's built-in sender only mails project team members, ~2 per hour. The repo's `auth-email-hook` (branded templates) is wired to **Lovable** (signature check + Lovable email queue), which no longer exists. | 🔴 |
| Reset link | Points at `<project>.supabase.co/auth/v1/verify` — works, but shows the Supabase address and email scanners can use up one-time links | 🟠 |
| `/reset-password` page | Needs the session from the link; after saving it sends a signed-in learner back to `/auth` | 🟠 |
| Google button (GIS, linguascript.co.uk) | Works (owner signed in with Google on the new backend) | ✅ |
| **Google fallback** ("Trouble with Google" path + automatic fallback in the button callback) | Calls `signInWithLovableGoogle` → `oauth.lovable.app` — **dead** since Lovable stopped | 🔴 |
| Google redirect (Supabase OAuth) | Supabase sends Google `redirect_uri=https://wxlvxkeqhdlknthmliql.supabase.co/auth/v1/callback`. Must be in the Google Cloud OAuth client's "Authorized redirect URIs" (not checkable from the sandbox) | ⚖️ owner check |
| Email rate limit | `rate_limit_email_sent = 2` per hour | 🟠 |
| Resend | `RESEND_API_KEY` already saved as a function secret on the new project; sending domain must be verified in Resend | ⚖️ verify on first send |

## 2. Plan

1. **Branded auth emails through Supabase's "Send Email" hook + Resend** (no dashboard work for Rowan): rewrite `auth-email-hook` to verify Supabase's standard-webhooks signature (`SEND_EMAIL_HOOK_SECRET`), render the existing LinguaScript templates (`_shared/email-templates/*`), send directly with Resend (`_shared/resend.ts`), log to `email_send_log`. Enable the hook in the auth config; raise the email limit to 30/hour.
2. **Reset link on our own domain:** `https://linguascript.co.uk/reset-password?token_hash=…&type=recovery`; `/reset-password` exchanges it with `verifyOtp`, then saves the new password and opens the app (`/discover`).
3. **Google fallback without Lovable:** `signInWithGoogleRedirect()` = `supabase.auth.signInWithOAuth({ provider: "google" })`; used by the fallback button and when the Google button's token can't become a session. Stop importing the Lovable auth module.
4. Test: hook signature + delivery with Resend's test inbox (`delivered@resend.dev`), reset page in a browser, build, health check. PR → merge to main.

Owner checks (Rowan, 1–2 min each): Resend → Domains shows `linguascript.co.uk` **Verified**; Google Cloud → OAuth client `83696703346-d088sh…` → Authorized redirect URIs includes `https://wxlvxkeqhdlknthmliql.supabase.co/auth/v1/callback`.

## 3. Prompt (as executed)

> Repo Clokka/LinguaScriptOfficial, backend Supabase `wxlvxkeqhdlknthmliql`. Read AGENTS.md (Google sign-in, Backend) and docs/audits/login-cleanup-2026-11-25.md. Clean up login only:
> 1. Rewrite `supabase/functions/auth-email-hook` for Supabase's Send Email hook: verify the `webhook-id/timestamp/signature` headers with `standardwebhooks` and `SEND_EMAIL_HOOK_SECRET` (format `v1,whsec_…`); payload `{ user, email_data: { token, token_hash, redirect_to, email_action_type, site_url, token_new, token_hash_new } }`; render the existing templates in `_shared/email-templates`; recovery links go to `https://linguascript.co.uk/reset-password?token_hash=…&type=recovery`, other types to `<SUPABASE_URL>/auth/v1/verify?token=…&type=…&redirect_to=…`; send with Resend via `_shared/resend.ts` (`RESEND_API_KEY`, from `LinguaScript <noreply@linguascript.co.uk>`, `EMAIL_FROM` override); log to `email_send_log`; on failure return `{ error: { http_code, message } }`.
> 2. Deploy it, set `SEND_EMAIL_HOOK_SECRET`, enable `hook_send_email_*` in the auth config, `rate_limit_email_sent = 30`.
> 3. `/reset-password`: accept `token_hash` + `type` (verifyOtp), then update the password and go to `/discover`; clear message for expired links.
> 4. Replace `signInWithLovableGoogle` with a Supabase Google redirect fallback; remove the Lovable import from `src/lib/googleSignIn.ts`.
> 5. Test with Resend's `delivered@resend.dev`, a browser run of `/reset-password`, `npx vite build`, `bash scripts/check-backend.sh`. Update AGENTS.md. Commit, PR, merge to main.

## 4. Result (25 Nov 2026)

| Check | Result |
|---|---|
| `auth-email-hook` deployed, `SEND_EMAIL_HOOK_SECRET` saved | ✅ |
| Forged hook request | ✅ refused (HTTP 401) |
| Signed recovery request → Resend test inbox | ❌ `Resend 403: The linguascript.co.uk domain is not verified` |
| Hook switched on in the auth config | ⏸ **Not yet** — waits for the domain, so resets don't get worse |
| `/reset-password` with an expired link | ✅ clear message + "send a new link" button |
| `/reset-password` with no link | ✅ invalid-link message |
| Google fallback | ✅ goes to `…supabase.co/auth/v1/authorize?provider=google` (no Lovable) |
| `npx vite build` | ✅ (no Lovable login left in the bundle) |

**To finish (Rowan → then Claude):** verify `linguascript.co.uk` in Resend (Domains → Add domain → copy the DNS records into Cloudflare → Verify). Then: enable `hook_send_email_enabled` + `hook_send_email_uri = https://wxlvxkeqhdlknthmliql.supabase.co/functions/v1/auth-email-hook` + `hook_send_email_secrets = <SEND_EMAIL_HOOK_SECRET>`, raise `rate_limit_email_sent` to 30, re-run the signed test, then a real reset.
