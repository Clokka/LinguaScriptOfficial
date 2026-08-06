# LinguaScript Mobile — Vibecoder setup guide

Follow this top-to-bottom. Skip nothing. If a step errors, paste the error to
Claude and it will fix it.

**Requirements before you start:**
- A computer (Mac / Windows / Linux) with **Node.js 20+** installed
  ([nodejs.org](https://nodejs.org))
- An Android phone (or an iPhone — Expo Go works there too, but the Play Store
  guide below is Android only)
- Your GitHub account access to `Clokka/LinguaScriptOfficial`

If you don't have Node.js on your machine yet: download the LTS installer from
[nodejs.org](https://nodejs.org), run it, restart your terminal. That's it.

---

## Step 0 — Get the code on your computer

Open a terminal (Mac: Terminal.app / Windows: PowerShell / Linux: any).

```sh
git clone https://github.com/Clokka/LinguaScriptOfficial.git
cd LinguaScriptOfficial
git checkout claude/app-language-play-store-kcowrg
cd mobile
npm install                     # ~2 min, downloads ~500 MB into node_modules
cp .env.example .env             # (already committed in .env if you ran the
                                #  cloud build; skip if the file exists)
```

Open `mobile/.env` in any editor and check it looks like this — the anon key
should already be filled in from the commit:

```
EXPO_PUBLIC_SUPABASE_URL=https://ffephracinqeylfhqkiz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi…(long key)…
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=            # leave empty for now
```

---

## Path A — See it on your phone in 5 minutes (Expo Go)

**What you're doing:** running your app on your phone via a free "player" app.
Fast, but Google Sign-In and push notifications won't work.

1. On your **phone**, open the Play Store, search **"Expo Go"**, install it.
2. On your **computer**, in the `mobile/` folder, run:

   ```sh
   npx expo start
   ```

3. A big QR code appears in the terminal.
4. Make sure your phone is on the **same WiFi** as your computer.
5. Open Expo Go on your phone → tap **"Scan QR code"** → point at the terminal.
6. The app opens on your phone. First launch takes 20–40 seconds while it
   downloads the JS bundle.

**What works in Expo Go:** magic-link email login, Home, Discover, Flashcards,
Vocabulary, Profile, Settings, daily reminder scheduling, haptics, share sheet,
deep links.

**What does NOT work in Expo Go:** Google Sign-In button (needs a real build),
push notifications from the server (local reminders still work). This is why
we move to Path B next.

Press `Ctrl+C` in the terminal to stop.

---

## Path B — Build a real installable APK in the cloud (EAS Build)

**What you're doing:** Expo's cloud servers compile your code into a real
`.apk` file. You download it, drag it onto your phone, install it. This APK
has Google Sign-In, push notifications, everything.

### One-time setup (~10 min)

1. Go to [expo.dev/signup](https://expo.dev/signup), create a free account
   with your email. This is your "Expo account" — same idea as a GitHub
   account.

2. In your terminal, install the EAS command-line tool. Run this once:

   ```sh
   npm install -g eas-cli
   ```

3. Log in to your Expo account from the terminal:

   ```sh
   eas login
   ```

   Type your email + password. Done.

4. From the `mobile/` folder, link this project to your Expo account:

   ```sh
   eas init
   ```

   It asks "Would you like to create a new project?" → **yes**.
   It writes a `projectId` into `app.json`. Commit that change.

### Build the APK (~15 min, mostly waiting)

```sh
eas build --profile preview --platform android
```

- First time it asks a few questions — accept the defaults for everything
  (generate a new keystore = yes, etc.).
- It uploads your code to Expo, builds it in the cloud, and prints a URL like
  `https://expo.dev/accounts/YOU/projects/linguascript/builds/xxxxx`.
- The build takes 8–15 minutes. You can close the terminal — the build keeps
  going in the cloud.
- When it's done, open the URL. There's a big "Install" button and a QR code.

### Get the APK onto your phone

Two ways:

**A.** On your phone, open the build URL in Chrome → tap "Install" → allow
"install from unknown sources" if prompted → done.

**B.** Download the `.apk` to your computer, plug your phone in via USB,
drag the file to your phone's Downloads folder, tap it on the phone to install.

---

## Path C — Publish to the Google Play Store

Only do this after Path B is working and you've tested the APK yourself.

### One-time setup

1. Go to [play.google.com/console](https://play.google.com/console), pay the
   **$25 one-time developer fee**, verify your identity.

2. In Play Console, click **"Create app"**. Fill in:
   - Name: LinguaScript
   - Language: English
   - Type: App
   - Free
   - Accept declarations

3. Note the **package name** it shows you (should be `xyz.linguascript.app`).
   If Play forces a different one, update `mobile/app.json` under
   `android.package` to match.

### Build the AAB (Play Store format)

```sh
cd mobile
eas build --profile production --platform android
```

Same as before, but produces a `.aab` file (App Bundle) instead of an APK.
Takes ~15 minutes.

### Upload to Play Console

1. In Play Console, left sidebar → **Testing → Internal testing**.
2. **Create new release** → drag the `.aab` you downloaded from EAS.
3. Fill in release notes ("Initial release").
4. **Save** → **Review release** → **Start rollout to internal testing**.

Internal testing means only accounts on your tester list can install it via
the Play Store. That lets you sanity-check the real Store experience before
going public.

### Fill out the store listing

In Play Console, left sidebar → **Grow → Store presence → Main store listing**:

- **Short description** (80 char): use text from `docs/data-safety.md`
- **Full description**: paste your existing description
- **App icon**: upload `mobile/assets/images/icon.png`
- **Feature graphic**: upload `mobile/assets/images/feature-graphic.png`
- **Phone screenshots**: upload the screenshots you already have (min 2)

Sidebar → **Policy → App content**:

- **Privacy policy URL**: `https://linguascript.xyz/privacy`
- **Data safety**: click through the questionnaire. Answers are in
  `docs/data-safety.md` at the repo root — every field is filled in there.
- **Content rating**: run the questionnaire. Answer honestly — LinguaScript
  gets "Everyone / PEGI 3".
- **Target audience**: 13+ (or your call).
- **Ads**: no ads.

Sidebar → **Testing → Internal testing** → **Testers tab** → add tester
emails (you + 2–5 friends). They get an opt-in link.

### Promote to production

Once internal testing looks good:

**Testing → Internal testing → Promote release → Production**.

Google reviews it (typically 1–3 days for first submission). If they reject,
they email you a specific reason. Fix, resubmit.

---

## Supabase migration (do this once, before anyone opens the app)

The push notifications and reminder settings write to two new tables. Apply
the migration:

**Easiest way (no CLI):**

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your
   project → **SQL Editor** → **New query**.
2. Open `supabase/migrations/20260804230000_mobile_notifications.sql` in this
   repo, copy the whole file.
3. Paste into the SQL Editor, click **Run**. Done.

**Deploy the push-sender edge function** (optional for now — only needed when
you want to send pushes from the server):

```sh
# From repo root, requires supabase CLI installed
supabase functions deploy send-push-notification
```

---

## Troubleshooting

**"expo: command not found"** → run `npx expo start` instead of `expo start`.

**"eas: command not found"** → `npm install -g eas-cli` (may need `sudo` on Mac).

**QR code scans but app doesn't open** → your phone and laptop are on
different networks. Connect both to the same WiFi. Corporate WiFi often
blocks this — use a phone hotspot instead.

**Build fails with a red error in the EAS logs** → copy the error, paste to
Claude, it'll figure it out.

**"Not signed in to Expo"** → `eas login`.

**Google Sign-In button does nothing** → this only works in Path B / real
builds, not Expo Go. Also requires you to set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
in `.env` — see the Google Sign-In section of `mobile/README.md`.

---

## What to ask Claude next

- "the eas build failed with this error: [paste]"
- "the app crashes on this screen: [screenshot or description]"
- "I need to add screen X" — Watch player, Story, Friends, LinguaScripts,
  Progress are all still to be built for mobile
- "I want RevenueCat / Play Billing wired up" — one session, not started yet
