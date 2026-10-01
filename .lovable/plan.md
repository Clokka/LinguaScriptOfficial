# Streak, XP, daily gift and Chameleon progression: audit and plan

## CURRENT SYSTEM (what's already built)

- **Current streak trigger:** your streak goes up when you hit your **daily word goal**. That's words reviewed today, counted on Flashcards. Watch time doesn't count toward it.
  - Revealing a gold "click me" word does **not** trigger the streak. Opening the app doesn't either.
  - The streak count and the date it was last earned are saved on your profile. Each day's minutes, videos, words and "goal met" are saved in a daily activity log.
- **Streak protection:** streak freezes are already built. You can hold up to 2, buy them for 100 gems, or win them at the 7, 30 and 100-day streak milestones. A freeze is used automatically when you miss exactly one day. Miss more than that and the streak resets to 1.
- **Current XP trigger:**

  | Action | XP |
  |---|---|
  | Save a word | 20 |
  | Review a card (correct) | 10 |
  | Review a card (wrong) | 5 |
  | Watch a video | 10 |
  | Line Blast | 15 × combo |
  | Reinforcement | 5 |
  | Session bonus (5 or more cards) | 10 |
  | Session bonus (10 or more cards) | 25 |
  | Daily goal reached | tops you up to the next level |

  So reaching your daily goal **guarantees one level-up a day**.
- **Current level system:**
  - Levels 1–5 come very fast (20, 50, 95 and 160 XP).
  - Levels 6–30 are tuned to about one level a day.
  - After level 30, each level takes noticeably longer.
  - Every level pays 25 gems, plus 100 more every 5th level and 250 more every 25th.
- **Current reward system:**
  - **Gift box on each level-up**, with the 3D chameleon opening it.
  - **Daily chest:** only after your daily goal is met. It pays 10 to 60 gems, growing over a 7-day run.
  - **Streak milestones:** 3, 7, 14, 30, 60 and 100 days, paying gems, a freeze or a Muskrat pet.
  - **Gem shop:** streak freeze, sneakers, trucker hat, Colobus and Inkfish.
  - Gems are calculated on the server, so learners can't fake them.
- **Current Chameleon system:**
  - **10 pets** in total.
  - **2 accessories** with real 3D models: sneakers and the trucker hat.
  - Accessories unlock at **level boxes 5, 10, 15 and 20**.
  - The pet already has reactions: celebrate, dance, wave, happy, excited, perfect.
  - Word saves deliberately don't make the pet react (your earlier rule).
  - There's a celebration screen when the streak goes up, plus the daily-goal "spike" effect.
- **Login/session tracking:** not tracked as its own thing. A day only exists in the activity log once you watch or review something.

### Problems found
1. **Easy to cheat.** XP, level and streak count are written straight from the browser. Anyone can edit them, and they feed the leaderboard and rewards. Gems are protected, but these aren't.
2. **The day ends at the wrong time.** "Today" uses UK time (UTC). For you in Bangkok, the day rolls over at 7am, so late-night study counts toward the wrong day and streaks can break unfairly.
3. **The streak only updates when Home loads.** If you hit your goal on Flashcards, the streak only ignites when Home is next opened.
4. **The daily chest is a second learning reward.** It needs the goal met, so it isn't a "you came back" gift.
5. **Few cosmetics.** Only 2 accessory models exist, and none are earned through real achievements.

## RECOMMENDATION: a variation of your model

Your "open → streak" idea is good for habit, but if opening alone keeps the streak, the 🔥 number stops meaning anything and the guaranteed daily level-up would be farmable. I suggest splitting it:

- **Recommended streak trigger:** the 🔥 is **recognised on open but only locks in after one tiny real action**: 1 flashcard, 1 LinguaScript item, or 1 minute of video. That takes about 20 seconds.
  - On open: "🔥 Day 8 is waiting, one card to keep it."
  - It flips to "kept" the moment that one action is done.
  - The full daily goal stays the target for the big reward. It's no longer the streak gate.
- **Recommended daily reward:** a **daily return gift** on the first open of the day. It's small: **+5 gems and 10 XP**, growing over 7 days (5, 5, 10, 10, 15, 15, 30 gems). It's shown once as a card on Home with the chameleon waving. It's not a pop-up and you never have to tap through it.
  - The current goal-gated chest becomes the **mission chest**.
- **Recommended learning reward:** keep today's XP values. They're already balanced so a normal day gives about one level.
  - Add a **mission bonus of about +50 XP** plus the mission chest when the daily goal is hit.
  - Keep the guaranteed level-up from the daily goal. It's your strongest hook and it's earned by real learning.
- **Recommended level-up behaviour:** unchanged (gift box and gems), plus a cosmetic unlock at milestone levels.
- **Recommended Chameleon behaviour:**
  - The chameleon is your companion. It waves on the return gift, celebrates when the streak locks in, and does a big celebration on mission complete or level-up.
  - **Cosmetics are earned through achievements**, not only bought. Some stay in the shop.

### Opening sequence (one screen, no pop-ups)
```text
Home top card:  🔥 7  | 🎁 +5 gems claimed (chameleon waves) | Today: Review 5 words  [Start]
first action -> 🔥 kept (small flame burst)
goal hit     -> +50 XP mission chest + level-up box (one celebration)
```

### What happens when
- **Open but learn nothing:**
  - You still get the small return gift. That's fine, because it's tiny.
  - The streak is **not** kept, and the flame shows "at risk".
  - An evening reminder email or notification goes out if you've opted in.
- **Genuine learning:** the streak locks in, XP is earned, and then the mission bonus, chest, level-up and pet celebration follow.
- **Stopping cheating:**
  - XP, streaks, gifts and achievements move to server functions with one-per-day or one-ever checks.
  - Today's activity is read on the server.
  - XP grants have a daily ceiling.
  - Days follow your own time zone.

## Achievement cosmetics: what you'd need

| Achievement | Reward |
|---|---|
| 7-day streak | Flame scarf |
| 30-day streak | Rare crown |
| 100-day streak | Cape |
| 500 words learned | Scholar glasses |
| 10 hours watched | Cinema headphones |
| Top 1,000 words complete | Green aura effect |
| Level 25 / 50 | Special colour pattern |

- **Already have:** 3D pet and accessory loading with slots (head, feet), the gift-box scene, item ownership and the shop. The streak and level hooks for unlocks are in place too.
- **You need to supply (or I generate):**
  - A 3D model for each new accessory, sized to the chameleon's head, neck or back bones. Today only Sneakers and TruckerHat exist.
  - Colours, patterns and auras can be done in code, so they don't need models.
- **Database additions:**
  - Give items a slot, rarity, how they unlock (shop, level, achievement) and an unlock rule.
  - Add an achievement checker that awards cosmetics once.
  - Add a time-zone field on profiles.
  - Add a daily return-gift claim and a mission-bonus claim. These reuse the existing reward claims, so no new table is needed for them.

## Technical details
- **Migration:**
  - `profiles.timezone text default 'UTC'`.
  - `shop_items` gets `slot`, `rarity`, `unlock` ('shop'|'level'|'achievement'), `rule jsonb`, `glb_path`.
  - Seed the new cosmetics.
  - RPCs (security definer):
    - `claim_return_gift()` (reward_claims kind 'return', key = local date)
    - `keep_streak()` (checks today's activity_log >0 server-side, moves streak_count/last_streak_date, freeze logic moved here)
    - `claim_mission_bonus()` (goal_met check, +50 XP)
    - `grant_xp(action, meta)` with a per-action value table and daily cap
    - `check_achievements()` (streak, green count, total minutes, frequency band, level)
  - Extend `protect_reward_columns` to also lock `xp_total`, `xp_level`, `streak_count` and `last_streak_date` from direct client writes.
- **Frontend:**
  - `XpContext.persistXP` → `grant_xp`.
  - `useStreakStatus` → `keep_streak` after any first activity (Flashcards, LinguaScripts and the watch-minute tick call `refresh`).
  - New `DailyReturnCard` on Home replaces the chest placement; DailyChestCard is relabelled as the mission chest.
  - Pet reactions: wave on gift, celebrate on keep and on mission.
  - Local date helper using the profile timezone, replacing `toISOString()`.
  - Accessory registry reads slot and glb_path from `shop_items`.
- **Unchanged:**
  - The level curve, gem payouts, freezes and gift-box scene.
  - The rule that word saves don't trigger the pet.

## Questions before I build
1. Streak gate: is one tiny action okay, or do you really want opening alone to count?
2. Return gift size: is +5 gems and 10 XP right?
3. Cosmetics: should I generate placeholder 3D accessories, or will you supply models? Code-only colours and auras can ship first either way.
