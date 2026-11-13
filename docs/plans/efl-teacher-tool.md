# LinguaScript for EFL Teachers: plan

> **Status:** planning (November 2026). Build the product first. The landing page comes after.
> **One sentence:** An online English teacher picks a short YouTube clip, LinguaScript turns it into a lesson with tappable dual subtitles, students watch it at home, and the teacher sees who watched and which words gave the class trouble.

---

## 1. Audit: what LinguaScript already has

More of this exists than you might expect. We extend it. We don't start again.

| Already built | Where | Good enough? |
|---|---|---|
| Schools/classes, teacher + student roles, email invites | `schools`, `school_members`, `school_invites` (supabase/migrations/20260624…), `create_school`, `bulk_invite_students` | ✅ Works. The word "school" is wrong for a freelance teacher, though: they think in **students** and **groups**. |
| Teacher sets a video as a task, with a note and a due date | `class_assignments` + `create_class_assignment` (drizzle/migrations/0016) | ⚠️ The teacher has to paste a **LinguaScript `/watch/<uuid>` link**. A real teacher only has a YouTube link. That's too much friction. |
| Teacher dashboard: tasks set/started/done, watched %, green %, CSV export | `src/pages/Teacher.tsx` (438 lines) | ⚠️ Works, but it's one long page. There's no per-clip view and no "words the class struggled with". |
| Student side: My classes, tasks, leave class | `src/pages/MyClasses.tsx`, `AssignedVideoNotice` | ✅ |
| Privacy rule: teachers see ONLY the videos they set | 0016 migration + AGENTS.md | ✅ This is a selling point. Keep it. |
| Paste any YouTube link → captions → LinguaScript video | `Browse.tsx` + `fetch-captions` | ⚠️ It's a **Pro** feature for learners. Teachers would need it free in their plan. |
| Schools marketing pages + enquiry form | `/for-schools`, `SchoolEnquiryForm`, HQ → School enquiries | ✅ That's for *schools*. Nothing exists yet for *freelance online teachers*. |
| Stripe checkout, portal, webhook | `create-checkout`, `payments-webhook` | ✅ It can take a new "Teacher" price. |
| Google sign-in | `google-auth` | ✅ Sign-in only. No Calendar/Sheets scopes yet. |
| MCP connector (ChatGPT/Claude) | `src/lib/mcp/tools` | ✅ Could later get teacher tools like "make me a clip lesson". |

**Missing:**
1. **Clips.** The player can't play only 0:42 → 2:10. It always plays the full film.
2. **Starting from a YouTube link.** The teacher should paste a YouTube URL, pick start/end, and go.
3. **A teacher plan / price.** Nothing in Stripe says "teacher".
4. **Class insight.** Which words the class tapped most and how they did on the follow-up quiz.
5. **A quick check after the clip.** A 5-question quiz made from the clip's words.
6. **Integrations.** None for teaching yet.
7. **Teacher onboarding.** `/teacher` assumes you already have a "school".

---

## 2. My honest input (read this before building)

1. **Do the teacher tool first and the Preply-style teacher marketplace much later.** A marketplace needs lots of teachers AND lots of students at the same time (the "chicken and egg" problem). Preply and italki spend millions on that. The teacher tool brings teachers in, and **each teacher brings their own students**. Once ~200 teachers use it, the marketplace ("find a teacher who uses LinguaScript") is easy to add. Upsell order: **learner → teacher tool → teacher directory/marketplace**.
2. **For online freelance teachers, the user IS the buyer.** A freelance teacher on Preply/italki/their own website pays from their own pocket. That makes the sale small, fast and self-serve (card, no meetings). Schools are a *second* persona with a slow sale (authority, budgets, procurement). Our `/for-schools` page already exists for them.
3. **You are customer #1.** You teach English. Use the tool with your own students every week before any landing page exists. Each time something annoys you, that's the next fix.
4. **"Integrate with everything" is a trap. Pick the integrations that save a teacher time every week.** Google makes some permissions "sensitive". Those need Google verification, which is why Connect YouTube is still hidden. So pick the easy ones first (see §7). Three of the most useful ones need **no Google verification at all**.
5. **A clip beats a whole film for teachers.** Lessons are 25–60 minutes. A 1–3 minute clip fits as homework or a warm-up, and it's cheaper for us too (less caption/translation work).
6. **Students should never pay for a teacher's homework.** A student invited by a paying teacher watches that teacher's clips free. That's how the teacher plan spreads.

---

## 3. ICP and buyer persona

### ICP: who we build for first
**An online freelance EFL teacher** who:
- teaches 1-to-1 or small groups on Zoom/Google Meet, often through Preply, italki, Cambly or their own site
- has 10–40 regular students, mostly adults or teens, A2–B2 level
- already uses YouTube clips in lessons, but by hand (pausing, writing vocab on a Google Doc)
- lives in Google Workspace: Calendar for lessons, Docs/Slides for materials, sometimes Sheets for student tracking
- earns per lesson, so **prep time is unpaid time**

### Persona: "Laura, 31, online English teacher"
- 22 students on Preply plus her own website. Charges £20–30/hour.
- **Goal:** better lessons with less prep, students who stay longer (retention = income), and standing out from 50,000 other tutors.
- **Pain:** spends 3–5 unpaid hours a week finding and prepping material. Students "forget" homework. She can't prove progress to students (or to parents of teens).
- **Where she hangs out:** TikTok/Instagram "teacher" accounts, YouTube ("how I plan my ESL lessons"), Facebook groups (ESL teachers online), Reddit r/TEFL, r/OnlineESLTeaching, Preply's teacher community.
- **Would pay:** ~£8–15/month if it saves 1+ hour a week. That's under one lesson's income.

### Second persona (later): the language school / academy owner
Has 5–50 teachers. Cares about consistent quality, reporting and price per seat. Slow sale. Use `/for-schools` and HQ enquiries.

---

## 4. Buyer's journey (what Laura thinks at each stage → what we give her)

| Stage | What Laura is thinking | What we give her | Measure |
|---|---|---|---|
| **Awareness** | "Prepping video lessons takes forever." / "My students don't do homework." | Short TikTok/Reels: "I turn any YouTube clip into a homework lesson in 60 seconds". Free blog/SEO pieces: "best YouTube clips for B1 English", "how to use films in ESL lessons". | Views, visits to /teachers |
| **Consideration** | "Is this better than EdPuzzle / Lyricstraining / doing it in Google Docs?" | Free tool with no sign-up: paste a YouTube link → see the clip with tappable subtitles and a word list. A comparison page. Demo video. | Free clips made, sign-ups |
| **Decision** | "Will my students actually use it? Is it worth £X?" | Free trial: **3 students free forever**, paid after that. The dashboard shows "4/5 students finished the clip" in week one. Privacy promise for students. | Trial → paid % |
| **Delight (after buying)** | "Can I get more out of it?" | Google Calendar/Classroom shortcuts, monthly progress report to send students, referral via the Partner programme (`/partners`). | Retention, referrals |

---

## 5. Sales discovery questions (GPCT + BA + C&I, HubSpot)

Use these in **10 short calls with real online teachers before building past Phase 1**. Write the answers in a Google Sheet (one row per teacher).

| Letter | Meaning | Questions to ask |
|---|---|---|
| **G**oals | What they want | "What would make this year a great year for your teaching business?" "How many students do you want?" |
| **P**lan | How they're trying now | "How do you find and prepare video material today?" "What tools do you use every week?" |
| **C**hallenges | What's in the way | "What's the most annoying part of prep?" "What happens when students don't do homework?" |
| **T**imeline | When | "When do you plan next term or month?" "When would you want to try something like this?" |
| **B**udget | Money | "What do you pay for tools now (Canva, Preply fees, etc.)?" "What would 1 hour saved per week be worth to you?" |
| **A**uthority | Who decides | "Do you decide on your own tools, or does a school or platform decide?" (Freelancer = them. School = find the owner.) |
| **C**onsequences (negative) | Cost of doing nothing | "If nothing changes, what happens to your students and your hours?" |
| **I**mplications (positive) | Win if solved | "If students did every homework clip, what would change for you?" |

**Kill/keep rule:** if fewer than 5 of 10 teachers say they'd pay at least £8/month, change the offer before building Phase 2.

---

## 6. The 4 Ps

| P | Decision |
|---|---|
| **Product** | "LinguaScript Classroom": clip lessons from any YouTube link, tappable dual subtitles, auto key-word list and 5-question check, a teacher dashboard linked to each student's own LinguaScript decks (words saved in a clip go into their red deck). The privacy rule stays. |
| **Price** | **Free:** up to 3 students and 3 active clips (enough to fall in love). **Teacher:** about **£9/month or £79/year**, up to 40 students, unlimited clips. **School:** per teacher seat, by enquiry. Students of a paying teacher watch that teacher's clips free. Invited students get a discount on LinguaScript Pro: the upsell back to learners. *(Test the price in the discovery calls. These are starting guesses.)* |
| **Place** | Self-serve on the website at `/teachers` (landing) → `/teacher` (app). Found through teacher TikTok/YouTube, ESL Facebook groups/Reddit, SEO, and the Partner programme (teachers earn commission for referring other teachers). Also a Chrome extension button on YouTube: "Make a LinguaScript clip". |
| **Promotion** | You (Rowan) as a real teacher using it: build-in-public content. Teacher partners via `/partners`. A free "YouTube clip → lesson" tool as the lead magnet. Later, case studies ("my students did 90% of homework"). |

---

## 7. Integrations ladder (easy first)

Google sorts permissions into three levels: **none needed**, **non-sensitive** (quick) and **sensitive** (needs Google's checking, which can take weeks). Start at the top.

| Order | Integration | How | Google check needed? |
|---|---|---|---|
| 1 | **Share to Google Classroom** | Classroom's "share" link button (no login) | ❌ None |
| 2 | **Calendar: homework due dates** | An `.ics` calendar feed URL per teacher/student ("Add to Google Calendar"); due dates appear automatically | ❌ None |
| 3 | **Export to Google Sheets** | Already have a CSV download. Add "Open in Google Sheets" using the `drive.file` permission (we only touch files WE create) | ⚠️ Non-sensitive, quick |
| 4 | **Calendar: create the lesson event** with the clip link | `calendar.events` scope | 🔴 Sensitive: wait until the teacher tool has paying users |
| 5 | Zoom / Google Meet "show clip in lesson" mode | Big-screen classroom mode, no API needed | ❌ None |
| 6 | Preply/italki | They have no public API: just make our links look great when pasted in their chat | ❌ |
| 7 | MCP: "Claude, make a clip lesson from this link for my B1 group" | new tool in `src/lib/mcp/tools` | ❌ |

Every new Google scope must also be named on `/privacy` (AGENTS.md rule).

---

## 8. Build plan (functionality first)

### Phase 1: Clip lessons (MVP, ~2 weeks). **Build this first.**
1. **Clips in the database:** `class_assignments` gets `start_seconds`, `end_seconds` (nullable = whole video). A clip is just a film + a time range, so no new copy of the video.
2. **Teacher pastes a YouTube link** in `/teacher` → reuse the Browse "paste link" import (`fetch-captions`), allowed free for teachers → picks start/end with a simple slider + preview → sets a note and due date.
3. **Player respects the clip:** `/watch/:id?start=42&end=130` (and the assignment's range) starts at `start` and stops with a "Clip finished 🎉" card at `end`.
4. **Key words for the clip:** list the clip's most useful words (reuse word frequency + `src/lib/coverage.ts`). The teacher can untick words.
5. **Student flow:** join link → sign up → lands on the clip. Words tapped/saved go into their normal decks (one review ladder, `packages/core/src/review.ts`).
6. **Teacher dashboard per clip:** who watched, watched %, green %, using the existing `class_assignment_progress`.
7. **Rename for freelancers:** "school" → "my teaching group" in the UI only (keep the table names).

### Phase 2: Proof of learning + teacher plan (~2 weeks)
1. **5-question check after the clip** (meaning-match + gap-fill from the clip's key words). Correct answers count as reviews via `promote` + `applySrsReview`.
2. **Class "tricky words"** for that clip: words most students got wrong in the check. Counted per clip, shown only when 3+ students answered, and students are told on `AssignedVideoNotice`. *(This follows the privacy rule: only what's tied to the task and what the student is told about.)*
3. **Teacher plan in Stripe** (free: 3 students/3 clips; paid: more), checked in `create_class_assignment` / `bulk_invite_students`.
4. **Integrations 1–3** from §7 (Classroom share, `.ics` feed, Open in Sheets).
5. Analytics events in `src/lib/analytics.ts`: `teacher_clip_created`, `teacher_student_invited`, `student_clip_finished`, `teacher_plan_started`.

### Phase 3: Growth (after 10+ paying teachers)
- `/teachers` landing page (copy via the linguascript-copywriter skill, design via linguascript-designer), plus the free no-signup "clip → lesson" tool.
- Teacher referrals through the existing Partner programme.
- Extension button on YouTube: "Make a LinguaScript clip".
- Classroom mode for live Zoom lessons.

### Phase 4: Ecosystem / marketplace (after ~200 teachers)
- Teacher profiles + "Find a teacher who uses LinguaScript" for learners → book a lesson (the Preply-style upsell). Take a booking fee, or charge teachers for featured listings.
- Calendar event creation (sensitive scope) once Google verification is done.

### Success numbers
- Phase 1: you use it with **your own students for 2 weeks**. 80% of assigned clips get finished.
- Phase 2: 10 discovery calls done. **5 paying teachers.**
- Phase 3: 50 paying teachers, under 8% monthly churn.

---

## 9. Build prompt: Phase 1 (paste this to Claude Code)

```
Read AGENTS.md and docs/plans/efl-teacher-tool.md first.

Build Phase 1 "Clip lessons" for online EFL teachers, extending what exists
(src/pages/Teacher.tsx, src/pages/MyClasses.tsx, class_assignments from
drizzle/migrations/0016, create_class_assignment RPC). Do not start new tables
for classes. Keep the teacher privacy rule exactly as AGENTS.md says.

1. Migration (supabase/migrations, new timestamped file): add nullable
   start_seconds int and end_seconds int to public.class_assignments with a
   CHECK (end_seconds IS NULL OR start_seconds IS NULL OR end_seconds > start_seconds),
   allow the same film twice with different ranges (replace UNIQUE(school_id, film_id)
   with UNIQUE(school_id, film_id, start_seconds, end_seconds) using COALESCE),
   and extend create_class_assignment with _start_seconds/_end_seconds params.
   Return the range from my_class_tasks. Copy types to
   packages/core/src/database.types.ts.
2. Teacher.tsx "Set a video task": accept a YouTube URL as well as a
   LinguaScript /watch link. For YouTube, reuse the same import Browse.tsx uses
   (fetch-captions) — teachers with a school where they are 'teacher' may import
   without Pro. Then show a small clip picker: YouTube preview + start/end
   inputs (mm:ss) + "Preview clip". Save with the range.
3. Watch.tsx: support ?start=&end= (seconds) and the assignment's range: seek
   to start, and at end pause and show a "Clip finished 🎉" card with
   "Back to my classes". Words tapped/saved work exactly as now.
4. MyClasses.tsx + AssignedVideoNotice: show the clip length ("2 min clip")
   and link with the range.
5. UI copy: show "my teaching group" instead of "school" for teachers in
   Teacher.tsx (table names stay). Use useT strings where they already exist.
6. Track analytics via src/lib/analytics.ts: teacher_clip_created,
   student_clip_finished (add to AnalyticsEvent).
7. Use the premium glass kit (src/components/premium) and PageLoading/Skeleton,
   never a bare spinner. Check `npx vite build` and `npx tsc --noEmit`.
Commit on the current branch when done and summarise what you changed.
```

Write the Phase 2 and 3 prompts only after Phase 1 has been used with real students. What you learn will change them.

---

## 10. Decisions Rowan still needs to make
1. Price: start at £9/month, or test £12?
2. Free plan limit: 3 students, or 5?
3. Name: "LinguaScript Classroom", "LinguaScript for Teachers", or something else?
4. Is "tricky words for the class" (Phase 2 point 2) OK under our privacy promise? (Plan: yes, per clip only, 3+ students, students told.)
