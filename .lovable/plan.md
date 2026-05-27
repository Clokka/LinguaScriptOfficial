# Audit + Fix Plan

## 1. French-only (other languages "Coming soon")

**File:** `src/pages/Onboarding.tsx` (step 1 language picker)

- In the "I want to learn" select, only **French** is selectable.
- Render Spanish/German/Italian/Portuguese etc. as disabled rows with a "Coming soon" badge.
- Force-set `target = "fr"` on mount; hide the level-blocking logic for other targets.
- Leave the **native** language picker untouched (still 16 langs).

No DB change required — `profiles.learning_language` already defaults to French use.

## 2. Optional "School" step in onboarding

**Files:** `src/pages/Onboarding.tsx`, new migration

- Add a new step (between current step 1 and 2) titled *"Are you learning with a school?"*
- Single text input (autocomplete-style) — fully optional, skippable with "Skip" button.
- Pre-fill / suggest **Truro College** if email domain matches `@truro-penwith.ac.uk` (or similar).
- Persist to `profiles.school` (new nullable text column).

**Migration:**
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school text;
```

## 3. Remove Google sign-in from onboarding/auth flow → Profile only

**Files:** `src/pages/Auth.tsx`, `src/pages/Profile.tsx`

- Strip the Google button + divider from `Auth.tsx`. Email + password only.
- In `Profile.tsx`, add an **Account** section:
  - If logged in via email → "Link Google account" button (calls `linkIdentity({ provider: 'google' })`).
  - If logged out (viewing /profile bounce) → show "Sign in with Google" there.
- Keep `supabase--configure_social_auth` Google enabled (already on) so linking works.

## 4. Mobile YouTube player feels "zoomed in"

**File:** `src/pages/Watch.tsx` (around line 535–545)

Root cause: on a 414px viewport the 16:9 iframe fills edge-to-edge with no breathing room, header eats vertical space, and YT controls/title bar feel cramped.

Fixes:
- Wrap the player in a centered container with **side padding on mobile** (`px-3 sm:px-0`) and a **rounded-2xl overflow-hidden** frame so it visually sits inside the page instead of bleeding to the edges.
- Cap height with `max-h-[55vh]` on mobile (keeps it from filling the screen and pushing subtitles off).
- Use `aspect-video` but center vertically with `my-auto` and add a soft black gradient surround for letterbox feel.
- Subtitle overlay: move from `bottom-[8%]` to `bottom-[12%]` on mobile so it doesn't overlap YT controls.

## 5. Flashcards — translation + orientation bugs

### A) Not translating French → English

**Investigation:**
- `Watch.tsx` saves `saved_words` with `language: learningLanguage || "fr"` and AI-fetched `translation`. ✓
- `Flashcards.tsx` auto-retranslates rows where `translation` is empty, calling `translate-word` with `fromLanguage = label(word.language)`, `toLanguage = label(nativeLang)`. ✓ logic
- Likely culprits:
  1. Old rows saved before `language` column existed → `language` defaults to `'fr'` but `translation` may have been stored as the French word itself (some early code path).
  2. `translate-word` returns `{translation: word}` when the AI echoes input (gemini-2.5-flash-lite sometimes does on single tokens with no system context).
  3. Native language never set → defaults to `'en'` so `fromLang === toLang` is impossible here, but worth logging.

**Fixes:**
- Harden `supabase/functions/translate-word/index.ts`:
  - Stronger system prompt: *"Never return the source word unchanged unless it is a proper noun."*
  - Bump model from `gemini-2.5-flash-lite` → `google/gemini-2.5-flash` for accuracy.
  - Validate: if `result.translation.toLowerCase() === word.toLowerCase()`, retry once with explicit "give the English meaning" instruction.
- In `Flashcards.tsx`:
  - Treat `translation === word` as "needs retranslation" alongside empty.
  - Add a small "Re-translate" button per card in "All" mode for manual recovery.
  - Show a toast when batch re-translation runs.

### B) Cards appearing "back to front"

**Investigation:** `Flashcard.tsx` front = `word` (French, "Learning Language" label), back = `translation` (English, "Your Language"). For an A-Level French learner who wants **active recall** (English → recall French), this *is* backwards.

**Fix:** add a direction toggle.
- New prop `direction: "learn→native" | "native→learn"` on `Flashcard` (default `native→learn` for recall — show English, recall French).
- Pill toggle in `FlashcardReview` header: **"Show: English → French / French → English"**.
- Persist preference in `localStorage` (`flashcardDirection`).

## Order of execution

1. Migration: `profiles.school`
2. Onboarding (French-only + school step)
3. `Auth.tsx` (remove Google) + `Profile.tsx` (link account)
4. `Watch.tsx` mobile aspect polish
5. `translate-word` hardening + `Flashcards.tsx` re-translate logic
6. `Flashcard` direction toggle

## Out of scope (deferred)

- Google Ads pre-roll (still on hold).
- Glassmorphism re-skin of full platform (huge — separate workstream).
- XP / leaderboards / schools admin dashboard.
