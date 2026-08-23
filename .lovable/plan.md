# Brand identity, daily goal loop, and bug fixes

## 1. One logo everywhere (no more default stack icon)

Today several screens fall back to a generic Lucide "layers" square (sign-in page is
the clearest example). Fix by building one small `BrandMark` component with two
variants — chameleon pin only, and pin + white/green "LinguaScript" wordmark — backed
by the brand assets already on the CDN.

Then drop it into every logo slot: Google/email sign-in, onboarding header, app header
on home, discover, profile, settings, vocabulary, and the LinguaScripts page. No page
keeps its own ad-hoc icon.

## 2. Daily goal loop: tally, completion nudge, review handoff

Goal sizes stay 1 / 5 / 8 words.

- While watching and saving, show a small live tally ("3 / 5 saved today") next to the
  save confirmation so progress is visible in the moment.
- On hitting the goal: a quiet, non-blocking card — "Goal reached. Review your
  LinguaScripts" — with one button that goes straight to the review session. No confetti
  spam, no forced modal; the tone is "small, sustainable, come back tomorrow".
- Home shows the same tally so users can see the day's target at a glance.

## 3. "LinguaScripts ready for review" button does nothing

On home the alert's action opens an in-page session that never mounts on some routes.
Change it to navigate to `/linguascripts` and start the session there, so the button
always lands somewhere real.

## 4. Inaccurate "700+ words added this week"

New accounts see a hardcoded/miscomputed weekly figure. Replace it with a real count of
words saved in the last 7 days for that user, and hide the line entirely when the count
is zero rather than showing a fake number.

## 5. Comprehension page colours

Swap the washed-out translucent state colours for the landing palette at full strength —
red `#FF3B30`, orange `#FF8A00`, green `#34C759` — on the category dots, counts, bars and
card borders, on the same near-black `#08080B` surfaces used on `/landing5`.

## 6. Landing cursor still stuck top-left on mobile

The cursor element renders before the capability check runs, so a frozen arrow paints at
0,0. Fix: never render the DOM nodes at all until the check passes (state-gated render),
rather than rendering then hiding.

## 7. Word-drag bug in LinguaScripts

In the gap-fill exercise the dragged block can detach from the pointer / drop on the
wrong target (visible in the video). Fix by using pointer capture on the block, tracking
one active pointer id, and hit-testing the slot on release — plus release cleanup so a
cancelled drag always returns the block.

## 8. Admin: Pro grants show "not_admin"

The admin panel is correct but your account is missing the `admin` role, so both the
grant panel and gift-link creation are refused by the database. Fix is to grant your
account the admin role; the UI then works as built.

## 9. Domain: hide `subtitle-mastery.lovable.app`

`linguascript.co.uk` is already connected and live. What's left is to make it the
primary/canonical domain so the lovable.app address stops being the one shown — done in
publish settings, plus the `www` variant needs its DNS finishing (it's still pending).
Canonical tags and OG URLs in `index.html` already point at `linguascript.co.uk`.

## Technical notes

- New `src/components/BrandMark.tsx`; assets from `src/assets/brand/*.asset.json`.
- Daily-goal tally reads existing `DailyGoalPicker` setting plus a count of today's
  `saved_words`; the nudge is a small component reused on Watch and Home.
- Cursor fix is a `useState` render gate in `LinguaCursor.tsx`.
- Drag fix is contained to `GapFillChallenge.tsx` / `WordBlock`.
- Admin role is a one-row insert into `user_roles`.
