# Personalised course + hard paywall in onboarding

> **Status:** plan (November 2026). **One sentence:** new app users answer a short, friendly discovery (HubSpot GPCT/BA C&I), try one real lesson free, watch LinguaScript *really* build their course (named, dated, in their hobby), see a preview of it, and then start it behind a hard paywall (with the existing card-up-front trial).

---

## 1. Audit: what we can salvage

| Asset | Where | Keep / change |
|---|---|---|
| 🦎 Swipe welcome cards (app, signed-out "/") | `src/components/AppWelcome.tsx` | **Keep as-is.** It's the intro; "Get started" goes to the new flow. |
| 4-step onboarding: language + level + mode + daily goal → hobby → written goal → dual-subtitle demo | `src/pages/Onboarding.tsx` (703 lines), progress saved in `ls.onboardingState.v1`, guests via `src/lib/guestOnboarding.ts` | **Salvage the steps** (language/level, hobby grid, goal, demo) into the new question screens. The resume-where-you-left logic and guest mode stay. |
| Learning modes "Fluency fast-track" / "Exam track (CEFR)" | `src/lib/languageProfiles.ts` (`MODE_META`, `addLanguageProfile` seeds known words by level) | Becomes a course **input**, not a question: exam goal → CEFR track. |
| Daily goal picker | `src/components/DailyGoalPicker.tsx`, `progressStats.ts` | Reuse for "minutes per day". |
| Hobbies | `src/lib/interests.ts` (`INTERESTS`) | Reuse: main hobby (+ optional second). |
| Sentence patterns ("Si ___, je ___") | `src/lib/sentencePatterns.ts`, `public.sentence_patterns` | **The syntax half of the template course.** |
| French Fast Track: 13 one-pattern lessons | `src/lib/cognates/fastTrack.ts`, `FastTrackLesson.tsx` | **Lesson format to copy** (substitution drills, ~2 min). |
| Frequency lists + coverage | `src/data/wordlists/*.json`, `public.core_vocabulary`, `src/lib/coverage.ts` (98/95/90) | **The word half of the template course** + milestone maths ("1,000 words = 76.6% of Spanish speech"). |
| Video recommendations at 95–98% coverage, hobby catalogue | `coverage.ts`, `public.hobby_video_catalog` | Daily lesson video, in the hobby. |
| One review ladder | `packages/core/src/review.ts` | Daily review block. Never a second schedule. |
| Stripe checkout, 14-day trial (card up front, reminder day 11), monthly $9.99 / yearly $79.99 / lifetime $199 | `supabase/functions/create-checkout`, `payments-webhook`, `src/pages/Pricing.tsx`, `TrialTimeline.tsx` | **Reuse** for the paywall screen. |
| Pro locks | `ProLockCard`, `ProLockDialog`, `UpgradeLockDialog`, `useSubscription` (14 files) | Paywall gate re-uses `useSubscription().isPro`. |
| Email + push | `dispatch-retention-emails`, `send-transactional-email`, `dispatch-push-notifications` | "Your course is waiting" and daily lesson reminders. |
| Class invites (students of a teacher) | `/classes`, invite links, teacher plan rule "students never pay for a teacher's homework" | **Teacher-paced students skip the paywall.** |
| Analytics funnel | `src/lib/analytics.ts`, `src/lib/experiments.ts` | New events + A/B test (section 8). |

**Gaps:**
1. No "course" exists: today the app is a library + decks, not a day-by-day pathway.
2. **The Android app has no Google Play Billing.** It's a WebView of the site with Stripe. A hard paywall *inside the Play app* selling a digital subscription must follow Google Play's Payments policy (normally Play Billing; alternatives only in some countries). → **Blocker to resolve before launching the paywall in the app** (section 7).
3. The marketing audit promised "the free plan stays free". A hard paywall changes that: decide what stays free (section 9).

---

## 2. The idea in one picture

```
Welcome cards → 8 quick questions (GPCT/BA C&I) → 1 free lesson (real demo)
  → create account ("save your course") → BUILDING YOUR COURSE (real work, ~10 s)
  → "Your course is ready" preview → PAYWALL (trial, card up front) → Day 1
                                   ↘ teacher/school student → class code → no paywall
                                   ↘ "a parent pays" → send-to-parent link
```

**Rule:** the build screen shows work that *really* happens, with the learner's real numbers. That's what makes it convincing (the "labour illusion" works because people value visible effort, Buell & Norton 2011) and it keeps us honest: no fake steps, no "our AI analysed your brain".

---

## 3. The discovery questions (HubSpot GPCT/BA C&I, friendly)

One question per screen, big tap answers, a free-text "Other", progress dots, ~2 minutes total. Every answer changes the course, otherwise don't ask it.

| # | Framework | Question on screen | Answers | What it changes in the course |
|---|---|---|---|---|
| 1 | (setup) | "What do you want to learn?" + "How much do you know?" | language · beginner/A2/B1/B2/C1 (existing step 0) | Start words (known words seeded by `addLanguageProfile`) |
| 2 | **Goal** | "Why are you learning {language}?" | Travel · Moving abroad · Partner/family · Exam · Work · Films/anime/music · School | Topic words, example sentences, course name |
| 3 | **Objective** (plan target) | "What do you want to be able to do?" | Follow shows without subtitles · Hold a 10-min conversation · Pass {exam} at {level} · Read a book · Get by on a trip | Finish line in words + skills (e.g. conversation = top 1,000 + speaking patterns; shows = ~3,000 for 95% of film) |
| 4 | **Timeline** | "By when?" | A date (trip / exam / move) or 1 · 3 · 6 · 12 months · "No rush" | Pace = words per day needed; dates on every lesson |
| 5 | **Plans** (today) | "What have you tried before?" (multi) | Duolingo · Classes · A tutor · Anki/flashcards · Netflix with subtitles · Nothing yet | Copy that respects what they did ("You've built a base on Duolingo, now real speech"); skip what they know |
| 6 | **Challenges** | "What's been hardest?" (pick 2) | Fast speech · Forgetting words · No time · Boring material · Nervous speaking · Grammar | Lesson emphasis: listening drills / more review / 5-min lessons / hobby videos / shadowing / pattern drills |
| 7 | **Implications** (positive, then negative) | "Imagine it's {date} and you can {objective}. What changes?" then "And if nothing changes by then?" | Chips: confidence abroad · understand my partner's family · better job · pass first time / miss out · pay for a resit · feel stuck again | Course welcome line + reminders use the learner's *own* reason. Keep it encouraging, never scary. |
| 8 | (time budget) | "How much time a day? When?" | 5 · 10 · 20 · 30 min · morning/lunch/evening + days | Lesson length, lessons per week, calendar reminders |
| 9 | **Hobby** | "Your favourite hobby?" (existing grid, + optional 2nd) | `INTERESTS` | Every video + example sentence |
| 10 | **Authority + Budget** | "Who's this for?" | Me (I'm paying) · My child · I'm in a class (teacher/school) · My employer | Paywall route (section 6). Budget is shown through plan choice, not asked bluntly |
| 11 | **Pace** | "How do you want to go?" | Self-paced · With my class/teacher (enter code) · To my exam date | Self-paced = streaks, no deadlines; class = teacher's tasks + term dates; exam = fixed end date |

Store answers in `profiles` + a new `course_plans.inputs` (jsonb). Minors: if "my child" or age < 16 is implied, don't send marketing to the child; ask for a parent email.

---

## 4. The course engine (template + personalisation)

**Template course** (same for everyone): frequency words in order + one sentence pattern per lesson, in units of one week:

| Lesson block | Minutes (10-min day) | Source |
|---|---|---|
| 1. New words (5–10, most frequent not yet known, biased to their goal topic) | 3 | wordlists / `core_vocabulary` |
| 2. One sentence pattern using those words (substitution drill) | 2 | `sentence_patterns`, Fast Track format |
| 3. One short clip in their hobby at 95–98% coverage | 3 | `coverage.ts`, `hobby_video_catalog` |
| 4. Reviews due today | 2 | `review.ts` ladder |
| 5. (optional) Say or write 3 sentences with today's words | 1 | Chameleon Method output; counts as a review |

**Personalisation** is a pure function, so it's fast, cheap, testable and the same on web and app:

```ts
// packages/core/src/course.ts
buildCourse(inputs, frequencyList, knownWords, patterns, today) → CoursePlan
```

- **Target words** from the objective (e.g. "conversation" ≈ top 1,000; "shows without subtitles" ≈ 3,000 for 95% of film; exam → CEFR band list).
- **Pace** = (target − known) ÷ lesson days until the date, capped by the time budget. **If the date is impossible, say so** and offer the realistic date ("At 10 min a day you'll reach 1,000 words by 2 May, not 14 March. Go 20 min/day, or keep the later date?"). Honesty builds trust and lowers refunds.
- **Milestones** come from the real coverage numbers ("Week 6: you'll know the words behind 70% of everyday Spanish").
- **Hobby** picks clips and example sentences; **challenges** change block lengths; **pace mode** sets dates or not.
- **AI only for words, not maths:** one `aiChat` call writes the course name and a 2-line welcome in the learner's words ("Maya's Spanish for Madrid: 12 weeks to your first real conversation"). Cached; fallback template if AI fails.

**Data** (new migration + one-paste `docs/sql/course-setup.sql`, because Lovable doesn't apply GitHub migrations):

- `course_plans`: id, user_id, language, inputs jsonb, target_words, start_date, end_date, minutes_per_day, days jsonb, pace ('self'|'class'|'exam'), name, welcome, status.
- `course_lessons`: id, plan_id, day_index, date, word_ids[], pattern_id, film_id, state ('locked'|'today'|'done'), completed_at.
- RLS: owner only (and the teacher sees nothing new: teacher privacy rule stays).

---

## 5. The "building your course" screen (real work only)

Full-screen, chameleon changing colour, one line ticking at a time (~1.2 s each, ~10 s total; skip button after 3 s for returning users). Each line shows a **real number from the plan just built**:

1. "Reading your answers: travel · conversation · by 14 March" ✓
2. "Removing the 120 words you already know" ✓
3. "Choosing your first 300 words: the ones behind 60% of real Spanish" ✓
4. "Finding football videos you'll understand 95% of" ✓ (real count)
5. "Ordering 24 sentence patterns, easiest first" ✓
6. "Scheduling 5 lessons a week, 10 minutes, every evening at 7pm" ✓
7. "Your course is ready" 🎉 (chameleon turns green)

Respect `prefers-reduced-motion` (no animation, list appears at once). Reuse the AlternatingLoader / decoder style so it matches the film loader.

---

## 6. Course preview → hard paywall

**Preview (one screen, scrolls):**
- Course name + their own reason ("so you can talk to Carlos's family at Christmas").
- A small chart: words known per week until the date, with the coverage line (real numbers).
- **Week 1** day by day: Lesson 1 marked ✓ (they already did it in onboarding), Lessons 2–5 with their words, pattern and hobby clip thumbnails.
- Weeks 2–12 shown as a blurred list with milestone names.
- "Add to Google Calendar" chip (see the calendar plan).

**Paywall:** "Start your course". Yearly first (best value), monthly, lifetime. The existing `TrialTimeline` (Today / reminder / plan starts), "Cancel any time in 2 taps", "Restore purchase / I already have an account". No dark patterns: real price per month shown, renewal terms clear, the trial reminder email stays.

**Routes that skip or redirect the paywall:**
- **In a class:** enter invite code → join `/classes` → teacher-paced course, free for teacher tasks (existing rule).
- **A parent pays:** "Send this course to a parent" → email/WhatsApp link to a checkout page showing the child's course; the child keeps Lesson 1.
- **Employer:** same checkout + VAT receipt.

**Abandonment (with consent only):** if they leave at the paywall, "Your course is saved" email after 1 day and one reminder after 3 days (marketing consent tick box on the account screen; PECR). Course stays saved for 30 days.

---

## 7. Blocker: Google Play billing

The Android app is a WebView of the website and has **no Play Billing**. Google Play's Payments policy generally requires Play Billing for digital subscriptions bought inside an app (alternative or external billing is allowed only in some countries, with conditions). A hard paywall that opens Stripe inside the Play app could get the app rejected.

**Recommendation:** add **RevenueCat** (one entitlement "pro" fed by both Stripe on the web and Play Billing in the app; `react-native-purchases` in `mobile/`, a native paywall sheet called over the WebView bridge `packages/core/src/bridge.ts`, and the webhook sets `is_pro` like `payments-webhook` does). Until then: launch the hard paywall **on the website/PWA onboarding first**, keep the Play app on the current flow. Check the current Play policy text before release; it changes often.

UK: subscriptions must be clear about price, renewal and cancellation (consumer law, and the DMCC Act 2024 subscription rules as they come into force). The existing trial reminder and in-app cancel already fit; keep them.

---

## 8. Measure it (and test before switching everyone)

New events (snake_case, via `src/lib/analytics.ts`): `onboarding_question_answered` {q, answer}, `free_lesson_completed`, `course_built` {target_words, weeks, pace}, `course_preview_viewed`, `paywall_viewed` (exists), `trial_started`, `upgrade_completed` (exists), `course_sent_to_parent`, `class_code_used`.

Funnel to watch: welcome → questions done → free lesson → account → course built → paywall → trial → paid (day 14) → still active day 30.

**A/B test, 2 arms only** (our traffic can't power more, see the landing test rule): A = today's freemium flow, B = personalised course + hard paywall. Run until each arm has a few hundred sign-ups; compare **paid after the trial** and **refunds/cancels**, not trial starts. Keep the winner.

---

## 9. Decisions for Rowan

1. **What stays free?** Recommendation: SEO pages, word lists, the Anki/Quizlet export of those lists, Lesson 1 and the extension's basic word colouring stay free (they bring people in). The app's daily course, videos, decks and reviews go behind the paywall.
2. **Existing free users:** keep their access (grandfather) and invite them to build a course with a discount.
3. **Trial:** keep 14 days with card up front, or 7 days? (Shorter trials often convert sooner; test later.)
4. **Prices:** keep $9.99 / $79.99 / $199, or show local prices (£, €, R$)?
5. **Web first, Play app after RevenueCat?** (recommended)

---

## 10. Build order

| Phase | What | Size |
|---|---|---|
| 0 | Decisions (section 9) + Play billing approach | 1 day |
| 1 | `packages/core/src/course.ts` (`buildCourse`) + tests; `course_plans` / `course_lessons` migration + `docs/sql/course-setup.sql` | 3–4 days |
| 2 | New question screens salvaged from `Onboarding.tsx` (one component per question, same resume/guest logic) + free Lesson 1 (Fast Track lesson format) | 4–5 days |
| 3 | Building screen + course preview + paywall screen (reuse `TrialTimeline`, `create-checkout`) + class-code and parent routes | 4 days |
| 4 | `/course` home: today's lesson, the week, progress to the date; lesson player (words → pattern → clip → reviews) | 5 days |
| 5 | Emails/push (course saved, daily lesson), analytics, A/B test switch | 2 days |
| 6 | RevenueCat + Play Billing in the Expo app, then turn the paywall on in the app | 4–5 days |

## 11. Build prompt (Phase 1–3, paste to Claude Code)

```
Read AGENTS.md and docs/plans/personalised-course-paywall.md first.
Build phases 1–3 for the WEBSITE onboarding only (not the Play app yet):
1. packages/core/src/course.ts: pure buildCourse(inputs, frequencyList, knownWords,
   patterns, today) returning a dated plan of daily lessons (new words, one sentence
   pattern, one hobby clip slot, review slot), target words from the objective,
   pace from the timeline capped by minutes/day, and an honest "realistic date" when
   the chosen date can't be met. Unit tests with fixed inputs.
2. Migration for course_plans + course_lessons (owner-only RLS) AND a re-runnable
   docs/sql/course-setup.sql ending with NOTIFY pgrst, 'reload schema'.
3. Rebuild src/pages/Onboarding.tsx as one question per screen (section 3), reusing
   the existing language/level, hobby and goal steps, ls.onboardingState resume and
   guest mode; then a free Lesson 1 (FastTrackLesson format), account creation with
   a separate marketing-consent tick box, the "building your course" screen showing
   only real numbers from buildCourse (reduced-motion: no animation), the course
   preview, and the paywall reusing create-checkout + TrialTimeline. Class code and
   "a parent pays" routes skip the paywall as described.
4. Analytics events from section 8 through src/lib/analytics.ts; put the new flow
   behind an experiment flag (2 arms) in src/lib/experiments.ts.
Run npx vite build, screenshot each new screen on a phone, open a PR.
```
