# Native-language app, smooth onboarding, no repeat onboarding

## 1. Show LinguaScript in the visitor's own language
- Detect language on first visit from the browser/phone language (`navigator.languages`), e.g. hi-IN -> Hindi, zh -> Chinese, ja -> Japanese, ru -> Russian. Fallback English.
- Once signed in, the learner's chosen first language (profile) wins; the onboarding "I speak" choice switches the app instantly.
- A small language switcher on the landing page and in Profile.
- First wave of translated screens (what a nervous beginner sees first): landing page, sign-in, onboarding, home, bottom/side navigation, LinguaScripts practice, Profile/Settings.
- Starting languages: Hindi, Chinese, Japanese, Russian, Spanish, French, Portuguese, Arabic, Korean, plus English. Other screens stay in English until the next wave.
- Translations are AI-written, reviewed nowhere yet — flagged to the owner.

## 2. Remove onboarding freezes
Found causes:
- Pressing Continue on the language step waits for several saves plus vocabulary seeding (can take seconds) with no spinner and no lock — the screen looks frozen and repeat taps fire it twice.
- Profile loading after sign-in overwrites choices the user just tapped (language/level jumps back).
- Intro video lookup re-runs on every language tap with no debounce.
- Any failed save leaves the user stuck with no message, so they press Skip.

Fixes:
- Move the step forward immediately; run saves in the background with a "Saving..." lock on the button and a retry toast on failure.
- Run vocabulary seeding after the step change, not before.
- Load the existing profile only once and never overwrite fields the user already changed.
- Guard against double taps; cancel stale intro-video lookups.
- Check the whole flow on a phone-sized screen with Playwright.

## 3. Logging in never repeats onboarding
- After email or Google sign-in, check the profile: onboarded -> straight to Discover; not onboarded -> onboarding.
- If someone already onboarded lands on /onboarding (e.g. a "Get started" button), redirect them to Discover.
- Mark learners as onboarded if they already have a learning language and level saved (covers older accounts that finished but weren't flagged).
- The guided tour only starts for brand-new accounts, never after login.

## Technical details
- Add `i18next` + `react-i18next`, `src/i18n/` with per-language JSON, detector using profile.native_language > localStorage > navigator. RTL `dir` for Arabic.
- Onboarding.tsx: `saving` state, optimistic `setStep`, background `addLanguageProfile`, `dirty` set to protect user edits from the profile fetch.
- Auth.tsx: replace `navigate(next)` with an onboarded check (shared helper with Index.tsx); Onboarding.tsx early redirect when `profiles.onboarded`.
- One-off SQL backfill: `onboarded = true` where learning_language and cef_level are set.
- Record the i18n decision in AGENTS.md.
