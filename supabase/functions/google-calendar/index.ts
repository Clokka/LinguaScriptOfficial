import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * "Connect Google Calendar" for LinguaScript Classroom teachers.
 * POST { action } with the caller's Supabase session (verify_jwt = true):
 *   store      { access_token, refresh_token? }  save tokens from the OAuth round trip
 *   status                                       { connected, connectedAt }
 *   events                                       the next 14 days of the primary calendar
 *   attach     { event_id, assignment_id }       add a clip link to that lesson's description
 *   disconnect                                   revoke at Google + forget the tokens
 * Scope: calendar.events (src/lib/classroom/calendar.ts). Tokens live in
 * google_calendar_connections (no RLS policies: server only).
 * The clip link is built here from an assignment the caller teaches — never
 * text sent by the browser.
 */
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const SITE = (Deno.env.get("SITE_URL") ?? "https://linguascript.co.uk").replace(/\/$/, "");
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const MARK = "LinguaScript clip for this lesson";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function accessTokenFor(userId: string): Promise<string | null> {
  const { data: c } = await admin.from("google_calendar_connections")
    .select("access_token, refresh_token, expires_at").eq("user_id", userId).maybeSingle();
  if (!c) return null;
  if (new Date(c.expires_at).getTime() - 60_000 > Date.now()) return c.access_token;
  if (!c.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: c.refresh_token, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const t = await res.json();
  await admin.from("google_calendar_connections").update({
    access_token: t.access_token,
    expires_at: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  return t.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing auth" }, 401);
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: "Invalid session" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "store") {
      if (!body.access_token) return json({ error: "Missing access_token" }, 400);
      const { data: existing } = await admin.from("google_calendar_connections")
        .select("refresh_token").eq("user_id", user.id).maybeSingle();
      const { error } = await admin.from("google_calendar_connections").upsert({
        user_id: user.id,
        access_token: body.access_token,
        // Google sends a refresh token only on first consent: keep the old one.
        refresh_token: body.refresh_token || existing?.refresh_token || null,
        expires_at: new Date(Date.now() + 3500 * 1000).toISOString(),
        scope: "https://www.googleapis.com/auth/calendar.events",
        updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "status") {
      const { data } = await admin.from("google_calendar_connections")
        .select("created_at").eq("user_id", user.id).maybeSingle();
      return json({ connected: !!data, connectedAt: data?.created_at ?? null });
    }

    if (action === "disconnect") {
      const { data: c } = await admin.from("google_calendar_connections")
        .select("access_token, refresh_token").eq("user_id", user.id).maybeSingle();
      const tok = c?.refresh_token || c?.access_token;
      if (tok) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok)}`, { method: "POST" }).catch(() => null);
      await admin.from("google_calendar_connections").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    const token = await accessTokenFor(user.id);
    if (!token) return json({ error: "not_connected" }, 409);
    const g = (url: string, init: RequestInit = {}) =>
      fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });

    if (action === "events") {
      const now = new Date();
      const q = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: new Date(now.getTime() + 14 * 86400000).toISOString(),
        singleEvents: "true", orderBy: "startTime", maxResults: "50",
      });
      const res = await g(`${API}?${q}`);
      if (res.status === 401 || res.status === 403) return json({ error: "not_connected" }, 409);
      if (!res.ok) return json({ error: "google_error" }, 502);
      const data = await res.json();
      const events = (data.items ?? []).filter((e: any) => e.status !== "cancelled").map((e: any) => ({
        id: e.id,
        title: e.summary ?? "(No title)",
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        allDay: !e.start?.dateTime,
        htmlLink: e.htmlLink ?? null,
        meetLink: e.hangoutLink ?? null,
        assignmentId: e.extendedProperties?.private?.linguascriptAssignment ?? null,
      }));
      return json({ events });
    }

    if (action === "attach") {
      const eventId = String(body.event_id ?? "");
      const assignmentId = String(body.assignment_id ?? "");
      if (!eventId || !/^[0-9a-f-]{36}$/i.test(assignmentId)) return json({ error: "bad_request" }, 400);
      const { data: a } = await admin.from("class_assignments")
        .select("id, school_id, film_id").eq("id", assignmentId).maybeSingle();
      if (!a) return json({ error: "Clip not found" }, 404);
      const { data: m } = await admin.from("school_members").select("member_role")
        .eq("school_id", a.school_id).eq("user_id", user.id).maybeSingle();
      if (!m || !["teacher", "school_admin"].includes(m.member_role)) return json({ error: "not_authorized" }, 403);
      const { data: film } = await admin.from("films").select("title").eq("id", a.film_id).maybeSingle();

      const evRes = await g(`${API}/${encodeURIComponent(eventId)}`);
      if (!evRes.ok) return json({ error: "Lesson not found in your calendar" }, 404);
      const ev = await evRes.json();
      // Replace an earlier LinguaScript block so re-attaching never stacks links.
      const old = String(ev.description ?? "").split(`\n\n${MARK}`)[0].split(MARK)[0].trimEnd();
      const block = `${MARK}: ${film?.title ?? "Clip"}\n${SITE}/watch/${a.film_id}`;
      const res = await g(`${API}/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: old ? `${old}\n\n${block}` : block,
          extendedProperties: { private: { linguascriptAssignment: a.id } },
        }),
      });
      if (!res.ok) return json({ error: "google_error" }, 502);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
