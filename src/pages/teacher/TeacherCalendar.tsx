// /teacher/calendar — LinguaScript Classroom ↔ Google Calendar.
// 1. Subscribe: clip due dates appear in Google Calendar (private .ics feed).
// 2. Lessons: with "Connect Google Calendar", see the next 14 days of lessons
//    and attach a clip to one; without it, "Add to a lesson" template links.
// Returning from Google's consent screen lands on /teacher/calendar?gcal=connect.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { useTeacher } from "@/lib/classroom/teacherData";
import {
  GCAL_RETURN_PARAM, GCAL_RETURN_VALUE, attachClipToLesson, captureGoogleCalendarConnection,
  disconnectGoogleCalendar, getCalendarFeedToken, googleCalendarConnectEnabled, googleCalendarStatus,
  googleSubscribeUrl, lessonTemplateUrl, listLessons, startGoogleCalendarConnect, webcalUrl, feedUrl,
  type CalendarLesson,
} from "@/lib/classroom/calendar";
import { EmptyCard, Icon, PageHeader, SectionTitle, cardCls, linkCls, outlineBtn, primaryBtn, softBtn } from "./ui";

const dayFmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
const timeFmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export default function TeacherCalendar() {
  const { user } = useAuth();
  const { clips } = useTeacher();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const live = clips.filter((c) => c.live);
  const upcoming = clips.filter((c) => c.due_at && new Date(c.due_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());

  // 1 — feed
  const [token, setToken] = useState<string | null>(null);
  const [tokenErr, setTokenErr] = useState(false);
  useEffect(() => { void getCalendarFeedToken().then((t) => { setToken(t); setTokenErr(!t); }); }, []);
  const copyFeed = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(feedUrl(token));
    toast({ title: "Calendar link copied", description: "In Google Calendar: Other calendars → + → From URL → paste." });
  };
  const resetFeed = async () => {
    if (!window.confirm("Make a new private link? The old link stops working, so you'll need to add the new one to your calendar again.")) return;
    const t = await getCalendarFeedToken(true);
    if (t) { setToken(t); toast({ title: "New private link made", description: "Remove the old LinguaScript calendar and add this one." }); }
  };

  // 2 — connect
  const enabled = googleCalendarConnectEnabled();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lessons, setLessons] = useState<CalendarLesson[] | null>(null);
  const [lessonErr, setLessonErr] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadLessons = useCallback(async () => {
    const r = await listLessons();
    if (r.error) { setLessonErr("Couldn't read your Google Calendar. Try connecting again."); setLessons([]); return; }
    setLessonErr(""); setLessons(r.lessons);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      if (params.get(GCAL_RETURN_PARAM) === GCAL_RETURN_VALUE) {
        const r = await captureGoogleCalendarConnection();
        const next = new URLSearchParams(params); next.delete(GCAL_RETURN_PARAM); setParams(next, { replace: true });
        if (r.ok) { track("teacher_calendar_connected"); toast({ title: "Google Calendar connected", description: "Your next two weeks of lessons are below." }); }
        else toast({ title: "Couldn't connect Google Calendar", description: r.error, variant: "destructive" });
      }
      const s = await googleCalendarStatus();
      if (!alive) return;
      setConnected(s.connected);
      if (s.connected) await loadLessons();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const connect = async () => {
    const linked = !!user?.identities?.some((i) => i.provider === "google");
    const r = await startGoogleCalendarConnect(linked);
    if (r.error) toast({ title: "Couldn't open Google", description: r.error, variant: "destructive" });
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Google Calendar? LinguaScript will stop seeing your lessons. Clip links already added to lessons stay.")) return;
    await disconnectGoogleCalendar();
    setConnected(false); setLessons(null);
    toast({ title: "Google Calendar disconnected" });
  };
  const attach = async (l: CalendarLesson) => {
    const id = pick[l.id] || l.assignmentId || live[0]?.id;
    if (!id) return;
    setBusyId(l.id);
    const r = await attachClipToLesson(l.id, id);
    setBusyId(null);
    if (!r.ok) { toast({ title: "Couldn't add the clip", description: r.error, variant: "destructive" }); return; }
    track("teacher_clip_added_to_lesson");
    toast({ title: "Clip added to the lesson", description: "The clip link is now in the event in Google Calendar." });
    await loadLessons();
  };

  const byDay = new Map<string, CalendarLesson[]>();
  (lessons ?? []).forEach((l) => {
    const k = l.start ? dayFmt(new Date(l.start)) : "Undated";
    byDay.set(k, [...(byDay.get(k) ?? []), l]);
  });
  const clipTitle = (id: string | null) => clips.find((c) => c.id === id)?.title;

  return (
    <>
      <PageHeader title="Calendar" sub="Put clip due dates and your lessons in Google Calendar, so homework fits your week." />

      <section aria-labelledby="feed-h" className="flex flex-col gap-3.5">
        <SectionTitle id="feed-h">Clip due dates in your calendar</SectionTitle>
        <div className={`${cardCls} flex flex-col gap-5 p-6`}>
          <div className="flex flex-wrap items-start gap-5">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[rgba(52,199,89,0.12)] text-[#34C759]"><Icon.calendar /></span>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
              <span className="text-base font-bold">Every clip you set shows up on its due date</span>
              <span className="text-sm text-[#A1A1AA]">One private calendar called “LinguaScript clips”. It updates by itself when you add, move or remove a clip. It shows only titles, groups and links, never students' progress.</span>
            </div>
          </div>
          {tokenErr && <p className="m-0 text-sm text-[#FF5A4F]">Your calendar link couldn't be made. Refresh the page to try again.</p>}
          <div className="flex flex-wrap gap-2.5">
            <a className={`${primaryBtn} ${token ? "" : "pointer-events-none opacity-50"}`} href={token ? googleSubscribeUrl(token) : undefined}
              target="_blank" rel="noreferrer" onClick={() => track("teacher_calendar_subscribed", { app: "google" })}>
              <Icon.plus />Add to Google Calendar
            </a>
            <a className={`${outlineBtn} ${token ? "" : "pointer-events-none opacity-50"}`} href={token ? webcalUrl(token) : undefined}
              onClick={() => track("teacher_calendar_subscribed", { app: "webcal" })}>Apple or Outlook</a>
            <button type="button" className={outlineBtn} disabled={!token} onClick={() => void copyFeed()}>Copy link</button>
          </div>
          <p className="m-0 text-xs text-[#8E8E98]">
            Google refreshes subscribed calendars every few hours, so a new clip can take a little while to appear.
            Keep this link private. <button type="button" className="font-semibold text-[#A1A1AA] underline" onClick={() => void resetFeed()}>Make a new private link</button>
          </p>
          <div className="flex flex-col gap-2 border-t border-[#1E1E23] pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#8E8E98]">Coming up in that calendar</span>
            {upcoming.length === 0 && <span className="text-sm text-[#A1A1AA]">No clips with a due date yet. <Link to="/teacher/clips/new" className={linkCls}>Set one</Link></span>}
            {upcoming.slice(0, 5).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-none text-[#A1A1AA] sm:w-72">{dayFmt(new Date(c.due_at!))} · {timeFmt(new Date(c.due_at!))}</span>
                <span className="font-semibold">Clip due: {c.title}</span>
                <span className="rounded-full bg-[#1C1C21] px-2 py-0.5 text-xs font-semibold text-[#A1A1AA]">{c.group}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="lessons-h" className="flex flex-col gap-3.5">
        <SectionTitle id="lessons-h" right={enabled && connected && (
          <button type="button" className="text-sm font-semibold text-[#A1A1AA] hover:text-[#F2F2F5]" onClick={() => void disconnect()}>Disconnect</button>
        )}>Your lessons</SectionTitle>

        {enabled && connected === false && (
          <div className={`${cardCls} flex flex-col gap-4 p-6`}>
            <span className="text-base font-bold">See your lessons and add a clip to each one</span>
            <span className="text-sm text-[#A1A1AA]">Connect your Google Calendar and LinguaScript shows your next two weeks. Pick a lesson, pick a clip, and the clip link goes into that lesson's event, ready to share with your student on Zoom or Meet.</span>
            <button type="button" className={`${primaryBtn} self-start`} onClick={() => void connect()}>Connect Google Calendar</button>
            <span className="text-xs text-[#8E8E98]">LinguaScript asks Google for calendar events access. We only read your next 14 days and only change a lesson when you press “Add clip”. Disconnect any time.</span>
          </div>
        )}

        {enabled && connected && (
          <div className="flex flex-col gap-4">
            {lessonErr && <div role="alert" className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4 text-sm`}><span className="text-[#FF5A4F]">{lessonErr}</span><button type="button" className={linkCls} onClick={() => void connect()}>Connect again</button></div>}
            {lessons === null && <div className={`${cardCls} h-24 animate-pulse`} aria-label="Loading your lessons" />}
            {lessons && lessons.length === 0 && !lessonErr && <EmptyCard title="Nothing in the next two weeks">Lessons you put in Google Calendar will show here.</EmptyCard>}
            {[...byDay.entries()].map(([day, items]) => (
              <div key={day} className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-[#8E8E98]">{day}</span>
                {items.map((l) => (
                  <div key={l.id} className={`${cardCls} flex flex-wrap items-center gap-4 p-4`}>
                    <span className="w-24 flex-none text-sm font-semibold text-[#D4D4D8]">{l.allDay || !l.start ? "All day" : timeFmt(new Date(l.start))}</span>
                    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
                      <span className="truncate text-[15px] font-bold">{l.title}</span>
                      <span className="text-[13px] text-[#A1A1AA]">
                        {l.assignmentId ? <>Clip: <b className="text-[#34C759]">{clipTitle(l.assignmentId) ?? "added"}</b></> : "No clip yet"}
                        {l.meetLink && <> · <a href={l.meetLink} target="_blank" rel="noreferrer" className={linkCls}>Meet link</a></>}
                        {l.htmlLink && <> · <a href={l.htmlLink} target="_blank" rel="noreferrer" className={linkCls}>Open in Google</a></>}
                      </span>
                    </div>
                    {live.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`clip-${l.id}`}>Clip for {l.title}</label>
                        <select id={`clip-${l.id}`} value={pick[l.id] || l.assignmentId || live[0].id} onChange={(e) => setPick({ ...pick, [l.id]: e.target.value })}
                          className="h-10 max-w-[220px] rounded-xl border border-[#2A2A30] bg-[#0F0F12] px-2 text-sm text-[#F2F2F5]">
                          {live.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.group}</option>)}
                        </select>
                        <button type="button" className={softBtn} disabled={busyId === l.id} onClick={() => void attach(l)}>
                          {busyId === l.id ? "Adding…" : l.assignmentId ? "Change clip" : "Add clip"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!enabled && (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-[#A1A1AA]">Plan a lesson around a clip: this opens Google Calendar with a new lesson and the clip link already in it.</p>
            {live.length === 0 && <EmptyCard title="No clips live" action={<Link to="/teacher/clips/new" className={primaryBtn}>New clip lesson</Link>}>Set a clip first, then add it to a lesson.</EmptyCard>}
            {live.map((c) => (
              <div key={c.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4`}>
                <span className="text-[15px] font-bold">{c.title} <span className="ml-1 text-xs font-semibold text-[#A1A1AA]">{c.group}</span></span>
                <a className={softBtn} target="_blank" rel="noreferrer" href={lessonTemplateUrl({ clipTitle: c.title, group: c.group, filmId: c.film_id })}
                  onClick={() => track("teacher_clip_added_to_lesson", { via: "template" })}>Add to a lesson</a>
              </div>
            ))}
            <p className="m-0 text-xs text-[#8E8E98]">Seeing your real lessons here (Connect Google Calendar) is waiting for Google's approval.</p>
          </div>
        )}
      </section>

      <p className="m-0 text-[13px] text-[#8E8E98]">Students can put their own due dates in their calendar too, from <b className="text-[#A1A1AA]">My classes</b>.</p>
    </>
  );
}
