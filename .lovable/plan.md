# Chinese, off-language videos, landing polish, app-wide dark theme

Four separate fixes plus one small addition, in the order they should ship.

## 1. Chinese as a learnable and native language

Chinese (`zh`) already exists in the shared language list but is filtered out of the
selectors the app actually uses. Add it to:

- Onboarding native + learning steps
- The header `LanguageSelector` (currently hardcoded to fr/es/de/it/en)
- Mobile onboarding and discover
- Language-name mapping used for translation prompts and text-to-speech, so Chinese
  words get a sensible pronunciation voice and translation label

## 2. Off-language videos still work (French learner watching an English video)

Today the watch page always asks the caption provider for captions **in the learning
language**. When someone learning French opens an English video, no French track
exists, the request returns nothing, and the player shows a "could not load captions"
error — even though the video is perfectly usable for learning.

New behaviour:

1. Ask for the learning language first (unchanged, best case).
2. If that comes back empty, fall back to whatever caption track the video actually
   has (the video's own language, or auto-detected).
3. Whatever track we end up with becomes the top subtitle line; the bottom line is the
   user's native language, produced by translation when no native track exists.
4. If the video language happens to equal the native language, translate the *other*
   way so the learner still gets a target-language line where possible, and show a
   quiet note: "This video is in English — showing English with your translations."

No error banner in any of these cases; the banner is reserved for videos with no
captions at all.

## 3. Landing page cursor on mobile

`/landing5` mounts the custom arrow cursor. It is already gated to fine pointers, but
the gate runs once on mount and some mobile browsers report a hover-capable pointer,
leaving a stuck arrow in the corner. Harden it: also require a non-touch device, bail
when `maxTouchPoints > 0`, and hide the arrow permanently after the first `touchstart`.

## 4. Quizlet + Anki mention

A quiet line near the bottom of `/landing5`, above the footer — small greyed logos and
one sentence: "Exports to Quizlet and Anki." Understated, matching the existing
footer type scale. Uses the two uploaded logo files as CDN assets.

## 5. Landing palette across the whole app

`/landing5` uses near-black `#08080B` surfaces, white type, and the three deck colours
(red `#FF3B30`, orange `#FF8A00`, green `#34C759`) as the only accents. Right now the
rest of the app runs a purple-led palette.

Plan: retune the global design tokens in `index.css` to the landing values —
background, card, border, muted, primary (green), accent (orange), destructive (red) —
so every shadcn surface picks the new scheme up without touching component code. Then
sweep the pages that hardcode purple or old greys (onboarding, discover, flashcards,
profile, pricing) and move them onto tokens. Onboarding additionally gets the
LinguaScript wordmark and chameleon assets already in `src/assets/brand/`.

This is the largest piece and the one most likely to surface stray hardcoded colours;
it lands last so the functional fixes are not blocked behind it.

## Technical notes

- Caption fallback lives in the `loadAllCaptions` path in `src/pages/Watch.tsx` plus
  the `fetch-captions` edge function, which needs an "any available language" mode.
- Language lists: `src/lib/languages.ts` is the source of truth; the fix is removing
  the local hardcoded subsets rather than adding Chinese in five places.
- Theme change is token-level in `src/index.css` and `tailwind.config.ts`; no
  component rewrites unless a page hardcodes a colour.
