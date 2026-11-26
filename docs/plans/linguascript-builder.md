# LinguaScript builder + "website as remote control" (plan, 26 Nov 2026)

## Rowan's decisions (26 Nov)
- **Core mechanic:** like Clozemaster but better. Instead of gap fills, **military-style substitution drills** (I will go → I will eat → I will swim). Every phrase part is tagged (subject, verb, object, time, place…).
- **LinguaScript** = a sentence the learner owns, built **only from words in their flashcards**.
- **When:** every **5 saved words** → "build a LinguaScript". Phrases from an **A1 → C2 essential-phrases blueprint** unlock when their key words are saved (save *gusta* + *mucho* → "Me gusta mucho…" unlocks) → pop-up "New phrase unlocked: go and build it".
- **Pop-ups:** +1% comprehension; "x / Top 50 words" after a Common Words save; deck complete → celebration "from X% to Y%" + share (link, WhatsApp, Instagram story).
- **AI check:** yes, a gentle fix plus praise. A correct use counts as a review.
- **Website = remote control.** Watching/reading happens in the **extension and the app**. The website organises flashcards, exports to Anki/Quizlet, and runs the sentence builder. The website's Watch page stays reachable by link but leaves the menu.
- **Later:** let learners choose phrase themes (e.g. romantic phrases).

## Update, 26 Nov (later): start simple
- **LinguaScripts are parked.** Rowan: phrases should follow each learner's **course, goals and hobbies, in context**, not one fixed list for everyone. Until then: the extension's 🔓 phrase and ✍️ "every 5 words" chips are off (`PHRASE_PROMPTS = false` in `extension/ls-core.js`), `/build` stays reachable only by its link, and the website tabs are **Today · Words · Me** (`src/components/AppTabs.tsx`).
- **Idea for the return:** pick phrases by the learner's goal (travel, work, exams…) and hobby, and by the video they just watched; the blueprint stays the backbone, with a `theme`/`goal` field per phrase.
- **New homepage (Rowan liked the mockup):** visitors → `/landing7` (`src/pages/landing/MinimalLanding.tsx`; switch it on in HQ → Today by typing /landing7, or A/B test it); signed-in learners → `/home` (`src/pages/Home.tsx`: next step, real % of film & TV words via `src/lib/filmCoverage.ts`, decks, extension connected). `Index` sends onboarded learners to `/home` instead of `/discover`.

## Built (first PR)
| Piece | Where |
|---|---|
| Essential phrases A1–C2, es + fr (12 per level, original, function-ordered) | `packages/core/src/phrases/` · `npm run test:phrases` |
| Extension celebrations (deck complete, phrase unlocked, +1%, every 5 words, ring progress toasts) | `extension/ls-core.js` `afterSaveCelebrations`, background `AFTER_SAVE` |
| Share page (story 1080×1920 / post 1080×1350, WhatsApp, copy link, download, Web Share) | `extension/share.html`, `share.js`, `share-card.js` |
| Website builder: pick phrase → swap drill → make it yours (flashcard words only, "+ Add" for others) → AI check → wrap-up | `src/pages/Build.tsx` at `/build` |
| Select a whole subtitle line to save it | `extension/ls-core.js` `LineHold` |

## Research behind the blueprint
Phrases are ordered by communicative function per level, after:
- Council of Europe, *CEFR Companion Volume* (2018/2020): can-do descriptors for spoken interaction.
- British Council & Eaquals, *Core Inventory for General English* (North, Ortega & Sheehan, 2010; posters 2018): functions per level.
- Instituto Cervantes, *Plan Curricular* (2006): functions inventory for Spanish.
- Chunks research (e.g. Cambridge Papers in ELT, *Learning language in chunks*, 2019). Formulaic language is common in speech, but corpus recurrence ≠ stored in the mind, so we drill *useful functions*, not raw n-gram lists.

Every phrase is written by LinguaScript. Never copy textbook or app phrase lists.

## Next steps (in order)
1. **Navigation, 4 tabs on the website:** Today (2-min drill + gold reviews) · Words (decks, scan, export) · My LinguaScripts (`/build` + saved sentences) · Me (progress %, devices, privacy). Hide Watch from the menu (keep the route). Put `/build` in the menu.
2. **Trust fixes from the design review** (`docs/audits/edtech-design-review-2026-11-26.md`): remove "95% more likely" (Onboarding), remove the fake ★★★★★ on `/landingpage3`, rewrite `PrivacyExtension.tsx`, use warm streak emails, hide "0 day streak", explain the disabled Share.
3. **Save LinguaScripts to the database** (they're on the device now: `ls.mine.<lang>`) so the extension can say "you used *voyager*, here it is in a video".
4. **More languages** for the blueprint (de, it, pt), and a `theme` field (romantic, travel, work…) for "choose your phrases".
5. **Phone app:** the same celebrations + builder through the WebView.
