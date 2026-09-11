# Fix: chosen language becomes French, and wrong intro video

## What's going wrong

Two separate faults, both traced today.

### 1. The chosen language is lost, then replaced with French

- The app keeps a "current language" in the browser that starts as **French** whenever nothing is stored yet.
- During onboarding, the language choice is only written to the account **if the person is already signed in at that step**. People who sign up later in the flow never get their choice saved — their account keeps whatever the database creates by default.
- Several screens (Profile, Browse settings) read the account language and, when it is empty, silently substitute **French** — and then save that back. So one visit to the profile page permanently rewrites the account to French.
- Current accounts: 29 sit on the untouched database default, 14 on French. That matches the pattern above.

### 2. The intro video is often French regardless of language

The onboarding intro video list only covers 6 languages (fr, ja, es, it, pt, de). Every other language — English, Korean, Arabic, Hindi, Russian, Turkish, Dutch, Polish, Swedish, Chinese, Thai — silently falls back to the French video. Some of the existing 6 entries also need to be re-checked against the actual video content.

## The fix

**Language never silently defaults to French**

- Remember the language choice made during onboarding even before sign-up, and write it to the account the moment the person signs in or signs up.
- Remove every "fall back to French" substitution in the app. If no language is known, the app waits for the account value instead of guessing, and never saves a guess back.
- Make the account's stored language the single source of truth; the browser copy only mirrors it.
- One-off data repair: for accounts that went through onboarding but never had a language written, leave the value untouched rather than overwriting; add a short prompt asking them to confirm their language once.

**Intro video per language**

- Build a complete video map covering all supported learning languages, including Thai.
- Verify each video is genuinely in that language (I will check each one and report the list back to you before it ships).
- Where no suitable video exists yet, show the step without a video rather than playing French, and flag the gap so we can add one.

## Technical notes

- `src/contexts/LanguageContext.tsx`: drop the `"fr"` initial value and the `TTS_VOICE_MAP` fallback to `fr-FR`; gate on the existing `ready` flag; treat `profiles.learning_language` as authoritative.
- `src/pages/Onboarding.tsx`: persist `target` to `localStorage` as a pending choice; apply it on auth state change (post-Google/email sign-up) as well as in `next()`.
- `src/pages/Profile.tsx` (lines 32, 58, 77) and `src/pages/Browse.tsx` (line 189): remove `?? "fr"` defaults so a save can't overwrite the real value.
- `src/lib/tourSteps.ts`: expand `TOUR_TRAINING_BY_LANG` to every code in `src/lib/languages.ts`; make `TOUR_TRAINING_YT_ID` a nullable lookup rather than a French default.
- Database: keep the `profiles.learning_language` default, but confirm onboarding always writes an explicit value so the default is never the effective setting.
