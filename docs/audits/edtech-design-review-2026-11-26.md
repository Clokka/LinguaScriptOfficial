# LinguaScript: emotional design and trust review (26 Nov 2026)

Read-only review. Files looked at: `AGENTS.md`, `docs/POSITIONING.md`, `brand/README.md`, `extension/popup.html`, `extension/popup.js`, `extension/manifest.json`, `extension/ls-core.js` (word card, toasts), `extension/background.js`, `src/components/FastTrackLesson.tsx`, `src/lib/cognates/fastTrack.ts`, `src/pages/Write.tsx`, `src/pages/Flashcards.tsx`, `src/pages/Vocabulary.tsx`, `src/pages/Onboarding.tsx`, `src/pages/PrivacyExtension.tsx`, `src/pages/LandingPage3.tsx`, `src/pages/landing/CoverflowLanding.tsx`, `supabase/functions/_shared/transactional-email-templates/streak-rescue.tsx`, `src/App.tsx`.

**The headline:** the honest bits are already strong. The Vocabulary growth card names its source, and the share card never overstates. Gentle save errors ("Couldn't confirm that save. Tap to try again") are good too. Trust leaks in three places: one made-up statistic in onboarding, an extension privacy page that no longer matches what the extension does, and guilt-based streak copy. Fix those first. They are cheap.

---

## 1. Top 10 improvements (ranked by impact ÷ effort)

| # | What the learner feels today | Change | Where | Before → after |
|---|---|---|---|---|
| 1 | "Is this made up?" Onboarding quotes "95% more likely". That figure is a well-known internet myth (the "Harvard/Yale goals study"). It has no real source. | Delete it, or swap in something you can source. | `src/pages/Onboarding.tsx` ~line 410 | "Learners who write down a clear goal… are 95% more likely to reach it." → "Write it in your own words. We'll pick videos and words for it." |
| 2 | Someone who checks before installing finds the extension privacy page doesn't match the extension. It still lists the "Identity" permission, which has been removed. It says the extension "does nothing on other websites", but the manifest now covers Crunchyroll, TV5MONDE and optional `https://*/*`. caption-hook also copies subtitle downloads. | Rewrite it as a plain table: permission → why → what leaves your device. Show it in the pop-up too (see #4). | `src/pages/PrivacyExtension.tsx`, `extension/manifest.json` | "The extension does nothing on other websites." → "On other sites it does nothing until you press **Turn on here** for that one site. You can turn it off any time." |
| 3 | Guilt. The email subject is "Your 7-day streak is in danger 🔥" and the body says "ends in a few hours". | Make it warm, give an out, and offer a streak freeze instead of a threat. | `supabase/functions/_shared/transactional-email-templates/streak-rescue.tsx` | "Don't lose your 7-day streak" → "7 days in a row: nice. One 2-minute drill keeps it going. Busy? Skipping one day is fine." |
| 4 | A new user sees "🔥 0 day streak" and "Today's words 0 / –". You start the day already failing. | Hide the streak until it's 1 or more. Swap the empty goal for a first step. Add a one-line privacy reassurance. | `extension/popup.html` (streak row, goal card), `extension/popup.js` line 29 | "🔥 0 day streak" → "🦎 Save your first word on any video to start." Footer: "🔒 We save only words you tap. We never see your history." |
| 5 | The **Share my progress** button is greyed out with no reason (`g.decks < 0.5`). Feels broken. | Keep it on and say what unlocks it. | `extension/popup.js` `loadGrowth()` | [Share (disabled)] → "Save 5 words to unlock your progress card" |
| 6 | Saving a word in the extension gives "+XP" and a tick, but no sense of the journey. The colour ladder is the brand, and it's invisible at the moment that matters most. | After the first save of the day, show a tiny ladder in the word card. Reuse the `WordSavedSheet` idea. | `extension/ls-core.js` `saveFromCard` / `celebrateSave` | "✓ Saved to your French flashcards" → "✓ Saved · 🔴 now → 🟠 → 🟢 → ✨ → 🔵. See it again in 5 videos and it turns orange." |
| 7 | A drill mistake shows red X "Not quite — it's:". Fine, but cold. The retry at the end ("Once more") reads like detention. | Make mistakes amber, not red. Red is the "new word" colour, so red-for-wrong blurs the brand meaning. Celebrate a fixed mistake. | `src/components/FastTrackLesson.tsx` (feedback block, `again` cue) | "Not quite — it's:" → "Close! Here's the sentence:" · "Once more — listen and type it" → "Your comeback round 💪" |
| 8 | The Flashcards empty state ("No saved words yet… Save words on Netflix") sends a beginner off to a paid streaming service. | Point to free things first: the starter deck and a YouTube video. | `src/pages/Flashcards.tsx` ~line 431 | "Save words on Netflix…" → "Start with the 50 words behind a third of French speech [Add starter deck]. Or tap words on any YouTube video." |
| 9 | The colours mean two things. Brand colours are word states, but `--orange` is used for the rings switch and streak. Gold/blue have no presence in the pop-up. | Use the five colours only for word states. Add the blue tier to `Deck.PALETTE`, as brand/README §6 already flags. | `extension/popup.html` (`.switch[aria-checked]`, `.streak b`), `extension/ls-core.js` `Deck.PALETTE` | Switch on = green (the main action colour). The ladder is shown once in the growth card. |
| 10 | The finished drill says "🎉 Lesson 3 done!" and then "Next lesson →". You're straight on to the next one, with no ownership moment. | End every drill with a "Make your LinguaScript" card (section 3). | `FastTrackLesson.tsx` finished state → hand off to `/write` logic in `src/pages/Write.tsx` | "Next lesson →" → "Now say something true about you →" |

---

## 2. Trust audit

**Claims and numbers**
- ❌ **"95% more likely"** (`Onboarding.tsx`): an unsourced myth. Remove it now.
- ❌ **"★★★★★ loved by learners"** (`src/pages/LandingPage3.tsx` line 172) is still on a live route (`/landingpage3` in `App.tsx`). There are no store ratings behind it. Delete the line, or switch the route off with HQ → "Landing pages: on or off". `LandingPage4.tsx` has a `TODO(rowan): real testimonials` placeholder. Keep it empty until the testimonials are real.
- ✅ "100 words ≈ half of speech" and "95% known words" (`CoverflowLanding.tsx`, `LabLanding.tsx`) come from `src/data/wordlists` and link to `/learn`. Good. Always keep the word "about". Languages range from 48% to 58%.
- ✅ The growth card names OpenSubtitles/FrequencyWords. The `story()` function in `popup.js` switches to "in my flashcards" when nothing is known yet. That is exactly right. One nuance to add: these are *word forms*, so "known" means green/gold in your decks, not tested fluency. Add an ⓘ: "Known = words in your green deck."
- ✅ There are no "first/only" claims in user-facing copy (the grep found only code comments). Keep it that way (POSITIONING §2).

**Privacy reassurance**
- The pop-up shows nothing about data at all. Add one line, linking to the policy: "We save only words you tap. We never see what you watch." Check that last part stays true. Today `background.js` only touches `profiles`, `language_profiles`, `saved_words` and `core_vocabulary`, so it is true.
- Before Chrome's own optional-permission prompt for "Turn on here", show plain words: "LinguaScript will read subtitles on **this site only**."
- The privacy page needs updating (#2): Identity removed, new sites, caption-hook, Alt+L reader, the "Add to LinguaScript" context menu.

**Social proof that's real**
- The best real proof you have is the learners' own share cards. Collect them with permission (an "OK to feature me?" tick on the share flow), then show them on the website with first name + language + date.
- Never write testimonials yourself, never invent learner counts, never show stars without a store rating behind them.

**Error, empty and loading states**
- Extension save errors are good: they offer a retry and never lose words. `AppInbox` keeps words on failure, which is excellent and should be said out loud: "Saved on this device; we'll sync when you're online."
- The pop-up has no loading state, so panels flash hidden. Add a skeleton line.
- `Write.tsx` imports `Loader2`. Swap any spinner-only state for `Skeleton`/`PageLoading`, per AGENTS.md.

**Onboarding promise vs reality**
- POSITIONING promises "a course built for you, 10 minutes a day". The Today screen and lesson player are still to-do (§9 step 4). Until they exist, onboarding shouldn't say "your course is ready". Say "your first video and words are ready".

---

## 3. Substitution drill + "Make your LinguaScript": emotional design

**The ideal 2-minute session**
1. **0:00 Warm-up (15 s):** one gold word from your deck ("✨ Remember *faire*?"). It's a quick win before any effort.
2. **0:15 Pattern card (15 s):** "I will ___." Three examples with audio. The slots are colour-tagged: subject = outline, verb = filled, object = dotted. The colours are shapes, not deck colours, so red/orange/green keep their meaning.
3. **0:30 Drill (60 s, ~10 swaps):** the sentence stays in the box and you swap one slot. Slot chips come from your own deck first, then the pattern list. Rhythm matters: answer → ding → the next cue appears in under 300 ms. Keep the current "last right sentence stays typed" mechanic (`FastTrackLesson.tsx`). It's the best thing in the file.
4. **1:30 Make your LinguaScript (30 s):** build one true sentence about yourself, only from your flashcard words. You can tap word tiles or type.
5. **1:55 Wrap-up:** each word you used shifts colour (🔴→🟠, a real review, as in AGENTS.md). The chameleon takes on that colour. "Your sentence is saved. We'll find it in a video."

**Moments of delight**
- **The word turns colour in place:** a 400 ms colour sweep on the tile itself, plus a soft ding. That is the brand moment.
- **The chameleon matches your best word today:** red mascot → orange → green. `ChameleonMascot.tsx` already has tiers. Add blue for 100% known.
- **"Heard it!":** later, when the extension hears a word from your LinguaScript in a video, a toast says "🦎 You used *voyager* yesterday. Here it is in the wild." This links output back to input, which no competitor does.
- **Streaks:** count days with any drill or save. Give a free "rest day" each week. Never reset loudly.

**Turning forced creation into ownership**
- Ask about *them*, not the grammar: "Say something true about your weekend / your hobby (football)". `Write.tsx` already has `ABOUT_QUESTION` and `hobby`, so reuse them.
- Name it theirs: "Your LinguaScript #12". Keep a personal collection on the website (it already lists "LINGUASCRIPTS · N").
- Hand over constraints like a game: "Use only your words. 3 tiles minimum."
- One tap to hear it spoken back by a voice, and to share it as a card.

**How mistakes should feel**
- Amber "Close!", never red. Show the fixed sentence *with their words kept*, and highlight only the one slot that changed.
- An incorrect LinguaScript is still saved: "Saved. We tidied one word: *allé → aller*." Effort counts, and only correct use moves the ladder.
- The comeback round is framed as a bonus, and a fixed mistake gets its own ding.

**Mockup 1: drill (swap one slot)**
```
┌──────────────────────────────────────┐
│ ←  ▓▓▓▓▓▓▓░░░░  7/10        ✨ 1 gold │
│ 🔁 SWAP THE VERB                      │
│         "to swim"                     │
│ ┌──────────────────────────────────┐ │
│ │ [Je] [vais] [manger|]            │ │
│ └──────────────────────────────────┘ │
│  subject   verb      ▢ object        │
│  (nager) (boire) (voyager)  💡 Hint   │
│ [          Check          ]          │
└──────────────────────────────────────┘
```

**Mockup 2: make your LinguaScript**
```html
<section class="ls-card">
  <p class="muted">Your turn · only your words</p>
  <h2>Say something true about ⚽ football</h2>
  <div class="tiles" translate="no">
    <button class="t green">je</button><button class="t green">vais</button>
    <button class="t orange">regarder</button><button class="t red">match</button>
    <button class="t green">ce soir</button>
  </div>
  <div class="answer" translate="no">Je vais regarder le match ce soir</div>
  <button class="primary">Make it mine 🦎</button>
</section>
```

**Mockup 3: wrap-up**
```
┌──────────────────────────────────────┐
│        🦎 (now orange)                 │
│   Your LinguaScript #12               │
│   "Je vais regarder le match ce soir" │
│   match  🔴 → 🟠   regarder 🟠 → 🟢     │
│   We'll tell you when you hear these  │
│   in a video.                         │
│   [ Share card ]   [ Done for today ] │
└──────────────────────────────────────┘
```

---

## 4. The website as a remote control

**4 tabs** (this adapts the POSITIONING §8 tabs to the new direction):
1. **Today**: the 2-minute drill + Make your LinguaScript, and gold reviews.
2. **Words**: decks (red/orange/green/gold/blue), search, scan a page, starter decks.
3. **My LinguaScripts**: the sentence builder (hobby + goal), your saved sentences, practise them aloud.
4. **Me**: progress (the same growth % as the extension), export to Anki/Quizlet, devices (extension and phone status), privacy, settings.

**Returning learner home: what they should get in 5 seconds**
```
Hi Sam · French · 🦎 (green)
[ ✨ 6 gold words ready  →  Review (1 min) ]
[ 🔁 Today's drill: "Je vais ___"  →  Start (2 min) ]
58% of French film & TV words are yours  (+0.4% this week)
Last saved: "voyager" on YouTube, 2 h ago
Extension ✓ connected · Phone ✓ connected
```
One primary green button (the most valuable next step), one number, and proof that their devices are synced. Nothing else above the fold.

---

## 5. Do not do

- No guilt or threat copy: "in danger", "you'll lose", sad-mascot pushes, or Duolingo-style passive-aggressive owls.
- No fake scarcity or fake timers ("offer ends tonight", "only 3 spots").
- No invented numbers, stars, learner counts or testimonials. No unsourced "% faster".
- Don't use red to mean "wrong". Red means "new word", and new is good.
- Don't nag for permissions. Ask for a site or overlay permission only at the moment it's needed, in plain words.
- Don't make streak loss loud. Don't paywall something the learner has already made (their sentences and words export free).
- No "first/only" claims without proof (ASA/CAP rules, per POSITIONING §2).
- Don't hide unsubscribe or "turn off" (keep "Turn off" in the bubble notification, as now).
