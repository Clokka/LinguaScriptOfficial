// LinguaScript Classroom ↔ Google Calendar (and Apple / Outlook).
//
// Three ways in, easiest first:
//  1. Private feed (no Google permission): class-calendar edge function serves
//     an .ics of clip due dates; Google Calendar subscribes by URL and keeps it
//     up to date. Teachers on /teacher/calendar, students on /classes.
//  2. "Add to a lesson" (no permission): a Google Calendar event template link
//     with the clip link already in the description.
//  3. "Connect Google Calendar" (calendar.events, a sensitive scope): see the
//     teacher's real upcoming lessons and attach a clip to one. Hidden until
//     Google verifies the scope, exactly like Connect YouTube.
import { supabase } from "@/integrations/supabase/client";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const GCAL_RETURN_PARAM = "gcal";
export const GCAL_RETURN_VALUE = "connect";

/** 1 — the private feed. */
export async function getCalendarFeedToken(reset = false): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_calendar_feed_token", { _reset: reset });
  return error ? null : (data as string);
}
export function feedUrl(token: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/class-calendar?token=${token}`;
}
/** webcal:// makes Apple Calendar / Outlook / phones offer "Subscribe". */
export function webcalUrl(token: string): string {
  return feedUrl(token).replace(/^https?:\/\//, "webcal://");
}
/** Opens Google Calendar's "Add calendar from URL" with our feed filled in. */
export function googleSubscribeUrl(token: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(token))}`;
}

/** 2 — a ready-made Google Calendar event for a lesson that uses this clip. */
export function lessonTemplateUrl(opts: { clipTitle: string; group: string; filmId: string; start?: Date; minutes?: number }): string {
  const start = opts.start ?? nextHour();
  const end = new Date(start.getTime() + (opts.minutes ?? 50) * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const link = `${window.location.origin}/watch/${opts.filmId}`;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `English lesson · ${opts.group}`,
    dates: `${f(start)}/${f(end)}`,
    details: `LinguaScript clip for this lesson: ${opts.clipTitle}\n${link}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
function nextHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

/** 3 — Connect Google Calendar. */
export function googleCalendarConnectEnabled(): boolean {
  if (import.meta.env.VITE_GOOGLE_CALENDAR_CONNECT === "1") return true;
  try { return localStorage.getItem("ls.googleCalendarConnect") === "1"; } catch { return false; }
}

/** Same Supabase Google provider as sign-in; see src/lib/youtubeConnect.ts for why the branch matters. */
export async function startGoogleCalendarConnect(alreadyLinkedGoogle: boolean): Promise<{ error?: string }> {
  const options = {
    scopes: CALENDAR_SCOPE,
    queryParams: { access_type: "offline", prompt: "consent" },
    redirectTo: `${window.location.origin}/teacher/calendar?${GCAL_RETURN_PARAM}=${GCAL_RETURN_VALUE}`,
  };
  const { error } = alreadyLinkedGoogle
    ? await supabase.auth.signInWithOAuth({ provider: "google", options })
    : await (supabase.auth as any).linkIdentity({ provider: "google", options });
  return { error: error?.message };
}

/** Run once on /teacher/calendar?gcal=connect: provider tokens exist only right after the redirect. */
export async function captureGoogleCalendarConnection(): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const access = (session as any)?.provider_token as string | undefined;
  const refresh = (session as any)?.provider_refresh_token as string | undefined;
  if (!access) return { ok: false, error: "Google didn't send calendar access. Please try connecting again." };
  return call({ action: "store", access_token: access, refresh_token: refresh ?? null });
}

export interface CalendarLesson {
  id: string; title: string; start: string | null; end: string | null; allDay: boolean;
  htmlLink: string | null; meetLink: string | null; assignmentId: string | null;
}
export async function googleCalendarStatus(): Promise<{ connected: boolean; connectedAt: string | null }> {
  const { data, error } = await supabase.functions.invoke("google-calendar", { body: { action: "status" } });
  if (error || !data) return { connected: false, connectedAt: null };
  return { connected: !!data.connected, connectedAt: data.connectedAt ?? null };
}
export async function listLessons(): Promise<{ lessons: CalendarLesson[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-calendar", { body: { action: "events" } });
  if (error) return { lessons: [], error: error.message };
  return { lessons: (data?.events ?? []) as CalendarLesson[] };
}
export function attachClipToLesson(eventId: string, assignmentId: string) {
  return call({ action: "attach", event_id: eventId, assignment_id: assignmentId });
}
export function disconnectGoogleCalendar() {
  return call({ action: "disconnect" });
}
async function call(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-calendar", { body });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: String(data.error) };
  return { ok: true };
}
