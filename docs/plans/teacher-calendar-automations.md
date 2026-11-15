# Teachers: Google Calendar integration + automations

> **Status:** plan (November 2026). **One sentence:** put LinguaScript into a teacher's (and learner's) day: lessons, homework and daily practice appear in their calendar automatically, and reminders and summaries are sent for them, starting with what needs **no Google verification**.

## 1. What already exists

| Piece | Where | Status |
|---|---|---|
| Private calendar feed per person (.ics): clip titles, groups, due dates, links; never progress | `class-calendar` edge function, `my_calendar_feed_token`, `src/lib/classroom/calendar.ts` (`feedUrl`, `webcalUrl`, `googleSubscribeUrl`) | ✅ Built (needs `docs/sql/classroom-setup.sql` run on the live DB) |
| "Add to a lesson" Google event template links | `lessonTemplateUrl()` | ✅ Built |
| "Connect Google Calendar" (`calendar.events`): list lessons, attach a clip to a lesson | `google-calendar` edge function, `listLessons`, `attachClipToLesson` | ✅ Built, **hidden** until Google verifies the scope (`VITE_GOOGLE_CALENDAR_CONNECT=1` / `ls.googleCalendarConnect=1` for testers) |
| Email + push senders | `send-transactional-email`, `dispatch-retention-emails`, `dispatch-push-notifications` | ✅ Reusable for reminders and digests |
| Teacher privacy rule | 0016 RPCs, AGENTS.md | Every automation must respect it: only set tasks, never app-wide activity |

## 2. The order (fastest value first, Google review last)

### Phase 1: "My week" in the calendar, no Google review (about 1 week)
1. **Class sessions:** a teacher adds each group's regular lesson slot once (e.g. "B1 group, Tue 18:00, 60 min, Zoom link"). New table `class_sessions` (group, weekday, time, timezone, length, meeting_url). Owner = teacher; students in the group can read their own group's slots.
2. **The feed shows lessons too:** `class-calendar` adds a weekly repeating event per session (RRULE) with the clip(s) set for that lesson in the description. Teachers *and* students see them, in Google, Apple and Outlook, through the feed they already subscribe to.
3. **Learner daily lessons:** for learners with a personalised course (see `personalised-course-paywall.md`), the same feed adds "🦎 LinguaScript: Lesson 12 (10 min)" at their chosen time. One "Add to Google Calendar" button in the course preview and Settings.
4. **One-tap subscribe** everywhere it's useful (teacher Calendar page, `/classes`, course preview), using `googleSubscribeUrl` / `webcalUrl`.

> Note: Google refreshes subscribed feeds on its own schedule (it can take hours), so the feed is for the weekly plan, not last-minute changes. Last-minute changes go by email/push (Phase 2).

### Phase 2: automations, no Google review (about 1 week)
1. **Auto due dates:** when a teacher sets a clip, the due date defaults to "before the next lesson" from `class_sessions`.
2. **Student reminders:** push/email 24 h before a task is due, only for students who haven't finished it (uses existing task progress; students can switch reminders off).
3. **Teacher digest (weekly, Sunday evening):** per group: tasks set, how many finished, the 10 words the class found hardest (only from set tasks, same as the dashboard).
4. **Lesson-day nudge for the teacher:** 2 h before a session: "Your B1 group: 6/8 watched 'Ordering food'. Hard words: *propina, cuenta*." with a link to the clip.
5. **Learner course reminders:** at the learner's chosen time, "Lesson 12 is ready (10 min)". Skipped days roll forward (the course re-dates itself instead of piling up).

### Phase 3: two-way Google Calendar (needs Google verification)
1. **Turn on "Connect Google Calendar"** once `calendar.events` is verified (submit the OAuth consent screen with a demo video and the privacy page listing the scope, as AGENTS.md requires).
2. **Write events directly** into the teacher's calendar when they create a session or set a task (instant, no feed delay); update/delete them when things change; add the Meet/Zoom link.
3. **Attach clips to existing lessons** (already built: `listLessons` + `attachClipToLesson`).
4. Ask only for `calendar.events`, never full calendar read access; store tokens server-side only (`google_calendar_connections`, already designed).

### Phase 4: later integrations (when teachers ask)
- **Google Classroom:** post a clip as Classroom coursework with a due date (restricted scopes, school admin approval). Only after the school persona is active.
- **Zapier / Make webhooks:** "task set", "task finished", "weekly digest ready" so teachers can send results to Notion, Sheets or their own tools without us building each one.
- **Outlook / Apple:** already covered by the .ics feed.

## 3. What to build first (recommendation)
Phase 1 items 1–2 (class sessions + lessons in the feed), then Phase 2 items 1–3 (auto due dates, reminders, digest). That gives teachers a calendar that fills itself and homework that chases itself, with no Google review and no new scopes.

## 4. Build prompt (Phase 1 + 2)

```
Read AGENTS.md and docs/plans/teacher-calendar-automations.md first.
1. Migration + docs/sql (re-runnable, NOTIFY pgrst at the end) for public.class_sessions
   (teacher-owned; students read their own group's rows) and RPCs to add/edit/delete.
2. /teacher/calendar: "Lesson times" editor per group (weekday, time, timezone,
   length, meeting link).
3. class-calendar function: add weekly RRULE events per session (with the clips set
   for that lesson), and learner course lessons when course_lessons exists. Never add
   progress or activity data to the feed.
4. Default task due date = before the group's next session.
5. Reminders + weekly teacher digest through the existing email/push functions,
   respecting the teacher privacy rule and an off switch for students.
Run npx vite build, test the .ics in Google Calendar, open a PR.
```
