# UI inspiration audit (draft, 25 Nov 2026)

## Read this first: what could and could not be checked

- **simplestudy.com, quizlet.com and design.duolingo.com / blog.duolingo.com could NOT be opened** from the build sandbox (DNS failed). Everything below about their look comes from search snippets and third-party write-ups, so treat it as a lead, not a fact.
- To finish the audit, allow those hosts in the cloud environment's network settings (or paste screenshots / CSS), then ask again and we'll fill in the gaps with real hex values and screens.

## Your brand, as already written down

From `brand/README.md`:

- Principal colour: green (the chameleon). Deck colours: red `#FF3B30`, orange `#FF8A00`, green `#34C759`, gold `#FFD54A`, blue (100% known) `#2F7BFF`.
- Deck colours mean word states and must not be reused for ordinary buttons (otherwise "green button" and "known word" blur together).
- Backgrounds: black (teacher UI already uses `#0B0B0D` / cards `#131316`) or white.

## What the research says (short)

**Duolingo** (from search snippets; official pages unreadable)
- Feather Green `#58CC02` anchors the brand, and the owl Duo is the most recognisable asset. Duo is written as social and emotional; the team deliberately shows his range of feelings.
- The mascot was simplified so it is easier to animate, which is why his moods read at a glance.
- Caution: Duolingo's green is also its "correct answer" colour. That is the same trick LinguaScript already has with word colours, so copy the *idea* (mascot moods), not the button habit.

**Quizlet** (search snippets only)
- The best-documented change is the 2016 redesign: bright, fresh colours and a friendlier mobile UI. No 2025 redesign was found.
- Has a night / dark theme, which fits a black base.
- The purple `#4257b2` figure is from an unofficial style-guide site, so do not rely on it.

**Simple Study**
- Nothing usable found. It needs to be checked directly once the host is reachable.

**Mascot and emotional design (general)**
- Round, circular shapes and a small character with a few clear states (happy, sad, idle) suit study apps (Studyloop and the Yolky concept in search results).
- One source claims a 48% engagement lift from gamification. I could not verify it, so do not quote it.

## Recommendations for LinguaScript

1. **Green stays the hero, black is home.** Use the chameleon and green for brand moments; keep white as the light mode, not a second brand.
2. **Keep buttons neutral (white on black, black on white).** Reserve green/red/orange/gold/blue for word and progress states. This is a choice for you to confirm (see question below).
3. **One mascot, five or six moods**, drawn from the existing SVG chameleon (`public/logo.svg`): happy (lesson done), cheering (word turns green or blue), thinking (quiz), sleepy (streak at risk, kind not guilt), encouraging (a miss), and a gentle wave for empty states. Each word-state mood uses its deck colour.
4. **Celebrate saves.** When a word is saved, the chameleon in the deck colour appears (already in `brand/README.md` §2). Add a short, warm line, not a streak-shame line.
5. **Rounded, friendly shapes**: big radius on cards, thick simple outlines, bouncy but short motion (respect reduced-motion, as `src/index.css` already does).
6. **Warm copy with the mascot**: the chameleon "speaks" in short, encouraging lines.

## Questions for you (I will not decide these alone)

- Should buttons be **neutral** (my recommendation) or **green** like Duolingo? Green buttons would make "known word" and "press here" look the same.
- Do you want a **second friendly accent** besides green (for example a soft warm tone for the mascot's belly), or keep it strictly to the five deck colours plus black and white?
- Are the three coloured chameleons (red / orange / green) and the blue one already uploaded? `brand/mascots/` is still empty in the repo.

## Next steps

- Allow the three hosts, then re-run the audit with real screens and colours.
- Turn the chosen direction into a short UI brief for the new UI agent, and add each decision to `brand/README.md` the same session.
