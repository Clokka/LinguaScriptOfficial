# Onboarding audit: is the new flow data-driven, and what do the best language apps do?

> **Status:** audit (November 2026), of the mock-up at the onboarding canvas and `docs/plans/personalised-course-paywall.md`. **Verdict:** the *shape* is backed by evidence (personalise → show value → save → reveal plan → paywall), but it asks too much before the first "aha", it is missing two proven pieces (notification priming and a real "what you already know" moment), and we have no baseline numbers yet.

## 1. What the evidence says

| Finding | Source | What it means for us |
|---|---|---|
| Moving sign-up later (let people try first) raised daily active users by about 20% at Duolingo; later refinements added ~8% more | [First Round Review: Duolingo's growth lead](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker) | ✅ Our "free Lesson 1 before the account" is right. Keep it. |
| Hard paywalls: median trial-to-paid ≈ 10.7% vs 2.1% for freemium, ~8× revenue per install at day 60, and almost the same 1-year retention (27% vs 28%) | [RevenueCat: hard paywall vs freemium](https://www.revenuecat.com/blog/growth/hard-paywall-vs-freemium), [State of Subscription Apps 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026.md) | ✅ A hard paywall can earn more. ⚠️ Cross-category medians, not education-only; fewer free users means less word of mouth, so keep the free SEO tools. |
| Longer trials tend to convert better than very short ones (secondary summary of RevenueCat data) | [RevenueCat education report](https://www.revenuecat.com/state-of-subscription-apps-2026-education) (education category page) | Our 14-day trial is reasonable. Test 7 vs 14 later, not now. |
| Babbel: goal quiz (travel, business, conversation) → mandatory sign-up → paywall with a 7-day trial | [ScreensDesign: Babbel](https://screensdesign.com/apps/babbel-language-learning/), [language-app onboarding round-up](https://screensdesign.com/articles/language-learning-app-onboarding/) | ✅ Same pattern as ours: quiz → account → paywall. |
| Busuu: choose your level or take a placement test, without losing the other option | [ScreensDesign: Busuu](https://screensdesign.com/apps/busuu-language-learning/) | 💡 A quick check of what you know beats a guessed level (see section 3). |

Numbers from third-party teardown sites are indicative only; we check our own funnel before trusting any benchmark.

## 2. What's strong in our flow
1. **Personalisation that really changes the course** (goal, hobby, date, time). People pay more readily for something visibly made for them.
2. **Value before the account and before the paywall:** a real Lesson 1 in their hobby.
3. **Plan reveal with a date and a chart** ("1,000 words by 14 March"). The predicted-progress chart is a common pattern among top subscription apps.
4. **Honest building screen:** every number comes from the real plan.
5. **Routes for people who shouldn't hit the paywall** (class code, parent pays).

## 3. What to change (in order of impact)

1. **Fewer screens before the first "aha".** Today: 7 question screens before anything is learned. Every extra step loses people. **Move Lesson 1 up to screen 5** (after language, goal, hobby, word check). Ask the "finish line, date, time, challenges" questions *after* the lesson, framed as "Let's make this yours".
2. **Replace the level picker with a 60-second word check:** show ~20 words from our frequency bands (top 100, 500, 1,000, 3,000), tap the ones you know, and get an instant, *real* result: *"You already know about 850 words: the ones behind ~72% of everyday Spanish."* This is our core idea (Zipf) turned into the first "wow", it makes the building screen's "skipping the words you know" number true, and nobody else's onboarding does it with real coverage numbers. (Estimate = known share per band × band size; coverage % from `src/data/wordlists`.)
3. **Add notification priming before the system prompt:** "Want a reminder at 7pm when today's lesson is ready?" → *then* Android/iOS asks permission. Reminders drive daily habits; a cold system prompt gets refused more often.
4. **Cut the negative "if nothing changes" question.** Keep one optional, positive "What changes when you can do this?" chip row on the finish-line screen. Negative framing can feel pushy and isn't needed.
5. **Paywall:** add one real learner quote once we have one (never invented), show "Cancel any time in 2 taps", and keep the trial reminder. Yearly pre-selected, monthly visible.
6. **After paying:** straight into Day 1, with the calendar chip ("Add your 7pm lessons to Google Calendar").

**Proposed order (12 screens, aha at 5):** Welcome → Language → Why (goal) → Hobby → **Word check (aha 1)** → **Lesson 1 (aha 2)** → Finish line + date (+ optional "what changes") → Time + reminder priming → Who's this for (+ pace) → Save account → Building → Course ready → Paywall → Day 1.

## 4. Make it data-driven (measure before and after)

**Events** (snake_case, via `src/lib/analytics.ts`, after consent): `onboarding_step_viewed` {step}, `onboarding_question_answered` {step, answer}, `word_check_completed` {known_estimate}, `free_lesson_completed`, `account_created`, `course_built`, `course_preview_viewed`, `paywall_viewed`, `trial_started`, `upgrade_completed`, `notifications_allowed`.

**Dashboard (PostHog funnel):** step-by-step drop-off; time per screen; welcome → paywall %; paywall → trial %; trial → paid at day 14; day-7 and day-30 lesson activity.

**A/B test:** 2 arms only (current flow vs new flow). Rough size: to see paid conversion move from ~3% to ~5% needs on the order of **1,000+ sign-ups per arm**. Until traffic allows that, judge early on **trial starts** and **day-7 activity** (bigger numbers, faster signal), and confirm on paid conversion later.

**Rule:** change one thing at a time after launch (order, then word check, then paywall copy), and keep a changelog of each test.

## 5. Next steps
1. Update the mock-up to the new order with the word-check screen.
2. Build the word check first (small, reusable, and great on the website too as an SEO tool: "How many Spanish words do you know?").
3. Then the course engine + onboarding, behind the experiment flag.
