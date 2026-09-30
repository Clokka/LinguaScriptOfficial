# Reward system: gift boxes, streak rewards, daily chest, gem shop

## Already fixed
The LinguaScripts "words reviewed today" count on the home page and the LinguaScripts page now only counts reviews in the language you're currently learning. If you switch to Spanish, it starts from 0.

## Borrowing instead of building from scratch
No open-source project matches our style well enough to drop in whole. The ones worth borrowing ideas from:
- **Gamification-Skill** (MIT): its rules for streaks, streak freezes and "each reward pays out once" are a good fit. We copy the logic into our own database functions.
- **StreakFlow** (MIT, same kind of database): calm streaks and freezes, a heatmap and badges. Good for the layout of the streak screen.
- **Motixion** (MIT, React + same database): a working "points shop" layout we can use as a guide for the gem shop.
We use our own green look, the chameleon and our existing gems and pets.

## What the learner gets
1. **Level-up gift box.** Every level comes with a box you tap to open. What's inside is always the same for each level, and you can see the next one coming ("Level 8: Trucker Hat"). Every 5th level gives a pet accessory, every 10th gives a new pet, and every other level gives gems. The level-up screen you have now opens the box.
2. **Streak rewards.** Gifts at 3, 7, 14, 30, 60 and 100 days. At 7 days you also earn a **streak freeze**, which saves your streak if you miss one day. You can hold up to 2. It's used up automatically and the chameleon tells you when it happens.
3. **Daily chest.** Finishing today's word goal unlocks a chest on the home page. It gives more gems the more days in a row you finish, up to 7 days: 10, 15, 20, 25, 30, 40, then 60. One chest per day, and only for the language you're learning right now.
4. **Gem shop.** A new tab under Pets where you spend gems on pets, accessories and streak freezes. It sells looks only. Gems can never buy XP or skip learning.

A rewards track on the Profile page shows your next 5 level rewards and your next streak milestone.

## Technical details
- New tables: `reward_claims` (user_id, kind: level|streak|daily, key, payload, claimed_at; unique on user_id, kind and key, so the same reward can't be paid twice), `streak_freezes` (count stored on profiles as `streak_freezes int default 0`), `shop_items` (read-only list).
- Security-definer database functions: `open_level_box(level)`, `claim_streak_reward(days)`, `claim_daily_chest(language)` (checks today's goal on the server), `buy_shop_item(item_id)` (takes the gems away in the same transaction). All with grants and row-level security.
- The streak update uses up a freeze when exactly one day was missed.
- `src/lib/levelRewards.ts` gets a fixed list of what each level gives (so the app can show it). The database copy stays the one that counts.
- UI: `GiftBoxReveal` (Framer Motion) on the existing level-up celebration, `DailyChestCard` on the home page under Today's goal, `StreakMilestones` on Profile, and a `GemShop` tab.
