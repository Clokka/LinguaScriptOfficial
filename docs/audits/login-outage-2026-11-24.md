# Login outage audit — 24 Nov 2026

**Symptom:** nobody can sign in to linguascript.co.uk, the Chrome extension or the phone app — not with email + password, not with Google. Lovable's own editor preview shows the same "Couldn't reach the LinguaScript server" error.

**Root cause (proven by direct tests):** the backend project `ffephracinqeylfhqkiz` (Lovable Cloud, which runs on Supabase) has its server switched off or unreachable. Supabase's front gateway is up, but every request that needs the project's own server — login, password check, database reads — waits ~20 s and returns **HTTP 522 "Connection timed out"**. The code and the website are configured correctly. No code change since 21 Nov causes this.

**Most likely reason:** the Lovable Cloud monthly credits are used up (owner confirmed: 0 credits, resets in December). Lovable's docs: Cloud usage (database instance, compute, storage…) is paid from a monthly Cloud grant that refreshes on the 1st. Only Lovable can confirm the project is paused for that reason.

Re-check any time: `bash scripts/check-backend.sh` (public key + a made-up account only).

---

## 1. Tests run (24 Nov 2026, 20:3x UTC)

All tests used the public publishable key from `.env` and, for the password test, a **made-up** account (`nobody-test-12345@example.com`). No real password was used.

| # | Test | Healthy result | Actual | What it means |
|---|------|----------------|--------|----------------|
| 1 | `GET /auth/v1/health` | 200 instantly | **522 after 20.1 s** | Login service unreachable |
| 2 | `GET /auth/v1/settings` | 200 instantly | **522 after 20.0 s** | Login service unreachable |
| 3 | `POST /auth/v1/token?grant_type=password` (fake account) | **400** "invalid credentials" instantly | **522 after 19.7 s** | The password is never even checked. A wrong password would give 400, not 522. |
| 4 | `GET /rest/v1/core_vocabulary?limit=2` (public table) | 200 | **522 after 19.8 s** | Database unreachable too |
| 5 | `GET /rest/v1/` (root) | 401 from gateway | 401 in 0.4 s, header `sb-project-ref: ffephracinqeylfhqkiz`, `sb-error-code: UNAUTHORIZED_INVALID_API_KEY_TYPE` | Supabase's **gateway** is up and recognises our key as a valid public key. This endpoint is answered by the gateway itself, not by the project. |
| 6 | `POST /functions/v1/google-auth` (fake token) | 401 "Invalid Google token" | 401 in 0.2 s | Edge functions run on separate machines and are up; they fail later when they need the database/login. |
| 7 | `GET https://linguascript.co.uk/auth` | 200 | 200 | Website (Cloudflare) is up. |
| 8 | Live bundle `assets/index-CHKHtmps.js` | uses `.env` URL + key | contains `https://ffephracinqeylfhqkiz.supabase.co` (2×) and the exact key from `.env` (2×) | The live site points at the right backend with the right key. |

The 522 page is Cloudflare's "supabase.co | 522: Connection timed out" (Ray ID a5fb2d4779c6eafb): Supabase's edge accepted the request but could not open a connection to the project's server.

## 2. Possible code causes — all ruled out

| Suspect | Checked | Result |
|---------|---------|--------|
| A security header (CSP `connect-src`) blocking the login server | `index.html`, `public/_headers`, `vite.config.ts`, `wrangler.jsonc`, `src/` | None exists |
| A service worker intercepting requests | `public/`, `navigator.serviceWorker` in `src/` | None registered |
| Code replacing `window.fetch` / XHR | `src/`, `public/`, `index.html` | None |
| Wrong backend URL or key in the live build | Downloaded live bundle (test 8) | Correct URL, correct key |
| Key rotated / invalid | Gateway response (test 5) | Key recognised as a valid publishable key |
| `.env` changed | `git log -- .env` | Last change 4 Nov (`9961102`), long before the outage |
| A database migration that broke the server | Migrations added since 18 Nov | Only `drizzle/migrations/0020_hq_allow_page_address_homepage.sql` — replaces two small homepage functions (`valid_site_page`, `publish_site`). Cannot stop a server. |
| The 21–23 Nov login rewrites | Diffs below | Change only the Google button flow and error texts. The password path never changed and fails the same way (test 3). |
| Ad blocker / phone network | Lovable's own preview page fails identically; this sandbox (different network, no ad blocker) gets 522 too | Not the device |

### Login-related commits since 13 Nov

| Date | Commit | Change | Can it cause 522? |
|------|--------|--------|-------------------|
| 14 Nov | `fbda8a9`, `19ecbdc` | Google's own button (GIS) so Google shows linguascript.co.uk; deploy `google-auth` | No |
| 18 Nov | `61fd881` | Fix Google button stuck on skeleton inside the phone app | No |
| 21 Nov | `aa2c7b6`, `556bbc1` | One Google sign-in on our domain (site + extension); never fall back to the backend-address Google screen | No — this is the "supabase URL on the Google screen went away" change the owner noticed. Cosmetic for Google; the old screen used the same server (`/auth/v1/authorize`), which now returns 522 too. |
| 22 Nov | `b940662`, `003a120` | Extension Google sign-in goes through the website; branded phone Google sign-in | No |
| 23 Nov | `fcd3747` | Google: 20 s limit per step instead of "Signing in…" forever | No |
| 23 Nov | `af89bff` | Google: fall back to Lovable Cloud's Google login (`oauth.lovable.app`) | No, but it is a Lovable dependency to remove when leaving Lovable |
| 23 Nov | `c51a7e3`, `6e57919` | Clearer error texts | No |
| 24 Nov | `a762c82` | Password: 20 s limit, then "Couldn't reach the server" instead of endless "Loading…" | No (fix) |

**Reverting to the old Google screen would not help:** that flow redirects to `https://ffephracinqeylfhqkiz.supabase.co/auth/v1/authorize`, i.e. the same unreachable server.

## 3. How login works (architecture)

```
Learner (phone browser / desktop / Chrome extension / phone app WebView)
   │
   ├─ Website  linguascript.co.uk ── Cloudflare Worker "linguascriptofficial"
   │            (static files; built from main by .github/workflows/deploy-cloudflare.yml)
   │
   ├─ Email + password ── supabase.auth.signInWithPassword ─┐
   ├─ Google button ───── Google (GIS) ID token             │
   │                       → signInWithIdToken / google-auth │
   │                       → fallback oauth.lovable.app      │
   ├─ Extension ───────── background.js signIn() / extension-handoff
   │                                                          ▼
   │              Supabase edge gateway  (UP: answers in 0.2–0.6 s)
   │                         │
   │                         ▼
   │              Project server ffephracinqeylfhqkiz  ✖ 522 — OFF / UNREACHABLE
   │              (login service + Postgres database: accounts, saved words,
   │               progress, classes; 161 RLS policies, 324 auth.uid() uses)
   │
   └─ Edge functions (39, incl. google-auth) — UP, but need the project server to finish
```

Every way of signing in ends at the project server, so one outage breaks all of them.

## 4. Options

| Option | Gets old accounts + saved words back? | Time | Cost | Notes |
|--------|----------------------------------------|------|------|-------|
| **A. Wait for the 1 Dec credit refresh** | Yes, if Lovable restarts the server | ~1 week | £0 | Not guaranteed to restart automatically — ask Lovable support. |
| **B. Top up / upgrade Lovable for one month** | Yes, within minutes of restart | Today | One month's plan | Then export everything (step B3) so you can leave Lovable safely. **The only way to get users back today.** |
| **C. New free Supabase project now** | **No** — fresh, empty accounts | ~1 hour for email login | £0 | Old data stays locked in Lovable until A or B. Google sign-in is extra work. |
| D. Cloudflare-only backend (Workers + D1) | No | 6–10+ weeks | Low | D1 has no row-level security; 107 queries, 23 RPCs, 161 policies to rewrite. Not a fix for today. |

**Important:** data can only be exported while the server is running. Leaving Lovable *with* your users' data needs A or B first.

**A "bypass" login is not possible:** accounts, decks and progress live on the stopped server, so a fake sign-in would show an empty app.

## 5. Plan

### Today
1. **Change the account password** once login works (it was pasted into a chat).
2. Send the Lovable support prompt (§6.1).
3. Decide between **B** (users back today) and **C** (owner back today, fresh account).

### If B (recommended when users matter)
- B1. Top up / upgrade in Lovable → billing.
- B2. Run `bash scripts/check-backend.sh` until all four lines say OK (typically minutes).
- B3. Export, while it runs: in Lovable chat use prompt §6.2 (database dump, auth users, storage, secrets list). Keep the files safe.
- B4. Create your own Supabase project and import the dump (prompt §6.3). When the `auth` schema is dumped and restored too, users normally keep their password hashes, so learners keep their passwords (test with one account first).
- B5. Switch the app: `node scripts/switch-backend.mjs <new-ref> <publishable-key>` → build → push to main → Cloudflare deploys.
- B6. Re-deploy edge functions to the new project (workflow `deploy-supabase-functions.yml` now takes the new ref) and set their secrets.
- B7. Google sign-in on the new project (Authentication → Providers → Google, same client ID; Google Cloud authorised origins).
- B8. Replace Lovable-only pieces: `LOVABLE_API_KEY` (AI gateway, 7 functions) → `GEMINI_API_KEY`; `LOVABLE_SEND_URL` (emails) → an email provider; remove `signInWithLovableGoogle` fallback + `@lovable.dev/cloud-auth-js`.
- B9. Cancel Lovable only after B2–B8 all work.

### If C (owner back today, old data later)
- C1. supabase.com → New project (London). Settings → API Keys → copy Project URL + publishable key.
- C2. Authentication → Sign In / Providers → Email on; "Confirm email" off for now (no email sender yet).
- C3. `npx supabase link --project-ref <new-ref>` then `npx supabase db push` (asks for the database password; 105 migrations — fix any that fail on a fresh project).
- C4. `node scripts/switch-backend.mjs <new-ref> <publishable-key>` → `npx vite build` → push to main.
- C5. Sign up a new account on linguascript.co.uk, check `bash scripts/check-backend.sh` all OK.
- C6. Later, when Lovable restarts (A/B): export and import old data (B3–B4).

## 6. Prompts

### 6.1 Lovable support (send today)
> My Lovable Cloud project "LinguaScript" (backend ref `ffephracinqeylfhqkiz`) stopped working: every login and database request returns HTTP 522 "Connection timed out" after ~20 seconds, while the Supabase gateway itself answers. My Cloud credits are at 0 and refresh on 1 December. Please tell me: (1) is the backend paused because of credits, and will it restart automatically on 1 December? (2) What is the quickest way to restart it today? (3) How do I export the full database, the auth users (with password hashes) and storage files so I can move to my own Supabase project? (4) How long do you keep a paused project's data?

### 6.2 Lovable chat, once the backend is back (export)
> Do not change any app code. Export everything I need to move this project's backend to my own Supabase project: (1) a full Postgres dump of the `public` schema and the `auth` schema (including auth.users and auth.identities with password hashes), (2) the list of storage buckets and their files, (3) the names (not values) of every edge-function secret, (4) the auth settings (site URL, redirect URLs, providers enabled, email templates). Give me download links or tell me exactly where to download each.

### 6.3 Claude Code, to move to your own Supabase project
> Repo: Clokka/LinguaScriptOfficial. Move the backend from Lovable Cloud (`ffephracinqeylfhqkiz`) to my Supabase project `<NEW_REF>` (publishable key `<PUBLISHABLE_KEY>`). Read docs/audits/login-outage-2026-11-24.md first. Steps: (1) run `node scripts/switch-backend.mjs <NEW_REF> <PUBLISHABLE_KEY> --dry-run` and show me, then run it; (2) `npm ci && npx vite build` and fix errors; (3) list every remaining Lovable dependency (`LOVABLE_API_KEY`, `LOVABLE_SEND_URL`, `@lovable.dev/cloud-auth-js`, `signInWithLovableGoogle`) and replace them (Gemini for AI, an email provider for auth emails); (4) give me the exact Supabase dashboard settings for Google sign-in and URL configuration; (5) run `bash scripts/check-backend.sh` and show the output. Commit to a branch; do not push to main until I confirm.

### 6.4 Quick health check (anyone, any time)
> In the LinguaScriptOfficial repo run `bash scripts/check-backend.sh` and tell me which lines fail. 522 = backend server off; 400 on the password line = backend healthy.

## 7. Resolution (25 Nov 2026)

Moved to the owner's own Supabase project `wxlvxkeqhdlknthmliql` (created Nov 2025, already configured for linguascript.co.uk with the same Google client):

- Old 2025 sample tables (0 users; 6 genres, 1 content row, 3 plans) moved — not deleted — to schema `legacy_2025`.
- All 99 dated `supabase/migrations`, 3 undated LinguaScripts files (`create_linguascripts_system`, `create_linguascripts_from_saved_words`, `add_review_tracking`) and all 21 `drizzle/migrations` applied in date order (drizzle files made duplicate-safe). 62/63 tables and 88/95 functions of `types.ts` exist; the 8 missing objects (`comprehension_snapshots`, `check_achievements`, `claim_return_gift`, `email_queue_dispatch`, `grant_xp`, `keep_streak`, `local_midnight`, `local_today`) are not used anywhere in the app.
- Auth: `www.linguascript.co.uk/**` added to redirect URLs; "Confirm email" OFF until custom SMTP (Resend) is set up — Supabase's default sender only emails project members.
- All 39 edge functions deployed. Existing secrets: GEMINI, OPENAI, RESEND, YOUTUBE, TMDB. Still missing (non-login features): LOVABLE_API_KEY users → switch to GEMINI, STRIPE_LIVE_API_KEY, GOOGLE_CLIENT_ID/SECRET (calendar), SITE_URL, RETENTION_DISPATCH_SECRET, LOVABLE_SEND_URL, SUPADATA_API_KEY, GOOGLE_TRANSLATE_API_KEY.
- `scripts/check-backend.sh`: 4/4 OK. Real login page (local build, headless Chromium): test account signed in → /onboarding, session saved.
- Not done yet: old users and data (need the Lovable backend running to export), Chrome Web Store upload of extension 1.7.6, phone app rebuild (mobile/.env), cron jobs that call the old project's URL.
