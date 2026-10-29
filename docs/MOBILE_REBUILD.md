# New Expo app: audit, plan and prompt

_Written 30 Oct 2026, before starting the new mobile app._

## The big picture (in plain words)

LinguaScript is four things in one repo:

| Part | Folder | What it is |
|---|---|---|
| Website | repo root (`src/`, `index.html`, `vite.config.ts`) | The main app at linguascript.co.uk. **Lovable edits this, so it must stay at the root.** |
| Shared brain | `packages/core/` | Rules and database helpers every app shares. |
| Chrome extension | `extension/` | Plain JavaScript, no build step. |
| Phone app | `mobile/` | Expo app. Today it is a WebView that shows the website, plus native Android extras. |
| Backend | `supabase/` | Database migrations and edge functions. |

The new Expo app replaces `mobile/` and gets its rules from `packages/core`, the same place the website now gets them.

## Audit: what I found and what I fixed

**Fixed in this restructure**

1. **The review rules were copied three times** (website, `packages/core`, extension). If one copy changed, the apps would disagree about which words are gold. Now:
   - `packages/core/src/review.ts` is the **one** copy: ladder, gold, colours, token matching.
   - The website imports it through the `@linguascript/core` alias (in `vite.config.ts`, `tsconfig*.json` and `remotion.config.ts`). `src/lib/vocab.ts` keeps only the website's database code.
   - The extension can't import TypeScript, so `npm run test:review` checks that its `deckState()` gives the same colour for every case. GitHub runs it too (`.github/workflows/review-rules.yml`).
2. **The shared database types were out of date.** `packages/core/src/database.types.ts` had 1,820 lines; the website's had 2,723. It is now a copy of `src/integrations/supabase/types.ts`. Re-copy it whenever a migration changes tables.
3. **`packages/core` deck reads didn't load the gold columns** (`interval_days`, `state_changed_at`, `green_revealed_at`), so a phone app built on them could never show gold. They load now, with a fallback if the column is missing.
4. **Messages between the website and the app weren't written down anywhere.** They are now typed in `packages/core/src/bridge.ts`: inbox, langs, deck, bubble, session, plus the file names and deep links. `AppInbox.tsx` and `PhoneBubbleSetting.tsx` use those types.
5. **Dates on phones:** `todayLocal()` used `toLocaleDateString("en-CA")`, which some phone JavaScript engines don't support fully. It builds the date by hand now, so it gives the same result everywhere.
6. **Loose notes in the root folder** moved to `docs/` (ARCHITECTURE, roadmap) and `docs/archive/` (old setup notes, the old shipping-plan .pptx, `pet-spawn-test.html`).

**Found, not changed (on purpose)**

- **The old app is on Expo SDK 51.** The current SDK is 57 (June 2026). Its native tab screens (`mobile/app/(tabs)/*`, about 2,800 lines) are never shown, because `app/index.tsx` only loads the website. It also carries a `vendor/react-native-worklets` workaround. Starting fresh is quicker than upgrading six SDK versions.
- **Three lockfiles** (`bun.lock`, `bun.lockb`, `package-lock.json`). Lovable manages these, so leave them.
- **`.env` is in git.** It only holds publishable keys (the Supabase URL and anon key, plus the payments client token), which are meant to be public. No secrets.
- **Remotion is in the website's `dependencies`.** It doesn't end up in the website bundle, but it makes installs slower. You can move it to `devDependencies` later.
- **The website's main JavaScript chunk is over 500 KB.** Code-splitting `Watch` and `Admin` would speed up the first load. That's separate from the phone app.

## Things the new app MUST keep (or Play Store updates break)

| Setting | Value | Why |
|---|---|---|
| Android package | `uk.co.LinguaScript.app` (capital L and S) | Play Store only accepts updates for the same package name. |
| iOS bundle id | `uk.co.linguascript.app` | Same, for the App Store. |
| EAS project id | `15c4a3cd-b8c2-47c3-aaa5-1977b72f1376` | Keeps the same signing key and build numbers. |
| EAS owner / slug | `rowanawesome1s-team` / `linguascript-chameleon` | Same EAS project. |
| Scheme | `linguascript` | Google sign-in returns to `linguascript://auth-callback`. |
| Intent filters | share text (SEND), `linguascript://`, `https://linguascript.co.uk/gift` and `/friends` | Share-to-save and invite links. |
| Native plugins | `plugins/withProcessText.js` + `process-text/`, `plugins/withWordBubble.js` + `word-bubble/` | Select-text card and the 🦎 bubble. They are plain Android code, so they work on any SDK. |
| `google-services.json` | copy as-is | Push notifications on Android. |
| `eas.json` | copy as-is | Build profiles. `appVersionSource: remote` lets EAS keep counting build numbers. |
| Version | higher than 1.3.0, e.g. 2.0.0 | Play Store needs a higher version. |

## The plan

**Approach: native app, website inside only for Watch (at first).**
The core loop (home, review cards, my words, profile, onboarding) is built native for speed and offline use. Watch (YouTube player + coloured subtitles) is the hardest screen, so it opens the website's `/watch/:id` page in a WebView at first. You move it native later, once the rest is live.

1. **Set up (day 1)**
   - Move the old app aside: `git mv mobile mobile-old`.
   - Create the new app in `mobile/` with the latest Expo SDK. Keeping the `mobile/` path means CI (`build-android.yml`) and EAS keep working.
   - Copy across the identity, plugins, `eas.json` and `google-services.json` from the table above.
   - Link `@linguascript/core` (`"file:../packages/core"`) and set Metro `watchFolders` to include `../packages`.
2. **Sign-in and data**
   - Supabase client from `createLinguaScriptClient` (core), stored in SecureStore.
   - Google sign-in (native) and email sign-in.
   - Reuse the old `native/` helpers (push, haptics, deep links, share).
3. **Core screens**
   - Home (due count, streak, XP).
   - Review cards with red/orange/green/gold, using `displayState`, `nextReviewInterval` and `submitReview` from core.
   - My words (filter by colour).
   - Profile and settings, including the 🦎 bubble switch and Colour/Rings, sent as `linguascriptbubble://` links.
4. **Watch**
   - A WebView screen for `/watch/:id`, using the existing bridge messages typed in `bridge.ts`.
   - The select-text inbox and the bubble deck keep working through the same files (`ls-inbox.json`, `ls-deck.json`).
   - Also write the deck file from native code, so the bubble works without opening the website.
5. **Ship**
   - Build preview APK → test on a real Android phone → production AAB → internal track → staged rollout.
   - Then delete `mobile-old/`.
6. **Later**
   - Native Watch player.
   - Offline review queue.
   - iOS build.
   - Write/Speak screens (when they come back on the website).

**Rules for every step**
- All deck rules come from `@linguascript/core`. Never write a second copy.
- Run `npm run test:review` after touching `packages/core/src/review.ts` or `extension/background.js`.
- Don't move or rename the website folders. Lovable syncs from the root.

## The prompt (copy-paste into a new Claude session on this repo)

```text
You're building the NEW LinguaScript phone app with Expo, in this repo
(Clokka/LinguaScriptOfficial). I'm a beginner "vibe coder": explain what you
do in simple words, and keep the app working at every step.

Read first: AGENTS.md, docs/MOBILE_REBUILD.md, packages/core/src/review.ts,
packages/core/src/bridge.ts, mobile-old/app/index.tsx (or mobile/app/index.tsx
if not moved yet), mobile/plugins/*.

GOAL
A native Expo app (latest stable Expo SDK, Expo Router, TypeScript) that
replaces mobile/. Native screens for Home, Review cards, My words, Profile and
Onboarding. Watch opens linguascript.co.uk/watch/:id in a WebView for now.
Look and feel: white or near-black backgrounds, brand green #7bbf27, and the
word colours red #FF3B30, orange #FF8A00, green #34C759, gold #FFD54A (gold has
a soft moving shine). No purple, no gradients everywhere. Big, friendly, simple.

STEP 1 — SET UP (stop and show me before step 2)
- git mv mobile mobile-old, then create the new app in mobile/.
- Keep EXACTLY: android.package "uk.co.LinguaScript.app", ios.bundleIdentifier
  "uk.co.linguascript.app", owner "rowanawesome1s-team", slug
  "linguascript-chameleon", extra.eas.projectId
  "15c4a3cd-b8c2-47c3-aaa5-1977b72f1376", scheme "linguascript", the Android
  intentFilters and permissions from mobile-old/app.json, version 2.0.0.
- Copy mobile-old/eas.json, google-services.json, app.config.js (the
  google-services check), plugins/withProcessText.js + plugins/process-text/,
  plugins/withWordBubble.js + plugins/word-bubble/, native/*.ts helpers.
  Update any API the new SDK changed (expo-file-system moved to a new API —
  check the docs).
- Depend on "@linguascript/core": "file:../packages/core"; add ../packages to
  Metro watchFolders. Prove it works: show displayState() on a test screen.
- Make sure .github/workflows/build-android.yml still builds mobile/.

STEP 2 — SIGN IN + DATA
- Supabase client via createLinguaScriptClient from core, session in
  SecureStore. Google sign-in (native) + email. Same Supabase project as the site.
- Push notifications: register like mobile-old/native/notifications.ts.

STEP 3 — CORE SCREENS
- Home: due-review count, streak, XP, big "Review" and "Watch" buttons.
- Review: cards due now (loadDueCards), flip to meaning, "Got it" / "Again" →
  submitReview. Colours from displayState. A word that turns green comes back
  gold 5 minutes later.
- My words: list with red/orange/green/gold filter chips.
- Profile/settings: languages, daily reminder, the 🦎 bubble switch with
  Colour | Rings (Android only) → Linking.openURL(
  `linguascriptbubble://${on ? "start" : "stop"}?style=${style}`).
- After the deck loads, write APP_FILES.deck (BubbleDeckWords format from
  bridge.ts) so the bubble works without opening Watch.
- On start, read APP_FILES.inbox (select-text saves) and save them to
  saved_words as red, then clear them (same as src/components/AppInbox.tsx).

STEP 4 — WATCH
- WebView of https://linguascript.co.uk/watch/:id with the user agent tag
  APP_USER_AGENT_TAG, the session injection and onMessage handling from
  mobile-old/app/index.tsx, using parseSiteMessage/SiteToAppMessage from
  bridge.ts. Back button goes back in the WebView first.

STEP 5 — SHIP
- eas build --profile preview (APK) → I test on my phone → fix → production
  AAB → submit to the internal track. Then delete mobile-old/.

RULES
- Every deck/review rule comes from @linguascript/core. Never copy it. If core
  is missing something, add it to packages/core (pure code in review.ts,
  database code in vocab.ts) and use it from there.
- After touching review.ts or extension/background.js: npm run test:review.
- Don't move or rename the website (root src/, vite.config.ts): Lovable syncs
  from there.
- Track events with snake_case past-tense names, like the website's
  src/lib/analytics.ts (PostHog).
- Small commits, one PR per step, and tell me in plain words what changed and
  how to test it on my phone.
```
