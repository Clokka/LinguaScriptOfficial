import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Private calendar feed (.ics) for LinguaScript Classroom.
 * GET /functions/v1/class-calendar?token=<64 hex>
 *
 * Google Calendar ("From URL"), Apple Calendar and Outlook subscribe to this
 * and refresh it themselves. The token (calendar_feed_tokens, made by the
 * my_calendar_feed_token RPC) is the only key, so the feed holds nothing
 * private: clip title, class name, due date and the clip link. Never any
 * student's progress (teacher privacy rule, drizzle/migrations/0016).
 *
 * verify_jwt = false (supabase/config.toml): calendar apps send no headers.
 */
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const SITE = (Deno.env.get("SITE_URL") ?? "https://linguascript.co.uk").replace(/\/$/, "");

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// RFC 5545: lines over 75 octets fold with CRLF + space.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (curLen + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; curLen = 0; }
    cur += ch; curLen += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Not found", { status: 404 });

  const { data: owner } = await admin.from("calendar_feed_tokens").select("user_id").eq("token", token).maybeSingle();
  if (!owner) return new Response("Not found", { status: 404 });

  const { data: memberships } = await admin.from("school_members")
    .select("school_id, member_role").eq("user_id", owner.user_id);
  const schoolIds = [...new Set((memberships ?? []).map((m) => m.school_id))];
  const roleOf = new Map((memberships ?? []).map((m) => [m.school_id, m.member_role]));

  type Row = { id: string; school_id: string; film_id: string; note: string | null; due_at: string | null; created_at: string };
  let tasks: Row[] = [];
  const names = new Map<string, string>();
  const titles = new Map<string, string>();
  if (schoolIds.length) {
    const [{ data: t }, { data: s }] = await Promise.all([
      admin.from("class_assignments").select("id, school_id, film_id, note, due_at, created_at")
        .in("school_id", schoolIds).not("due_at", "is", null),
      admin.from("schools").select("id, name").in("id", schoolIds),
    ]);
    tasks = (t ?? []) as Row[];
    (s ?? []).forEach((r) => names.set(r.id, r.name));
    const filmIds = [...new Set(tasks.map((r) => r.film_id))];
    if (filmIds.length) {
      const { data: f } = await admin.from("films").select("id, title").in("id", filmIds);
      (f ?? []).forEach((r) => titles.set(r.id, r.title));
    }
  }

  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LinguaScript//Classroom//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:LinguaScript clips", "X-WR-CALDESC:Clip lessons due in LinguaScript Classroom",
    "REFRESH-INTERVAL;VALUE=DURATION:PT3H", "X-PUBLISHED-TTL:PT3H",
  ];
  for (const t of tasks) {
    const due = new Date(t.due_at as string);
    const start = new Date(due.getTime() - 15 * 60 * 1000);
    const teaching = roleOf.get(t.school_id) !== "student";
    const title = titles.get(t.film_id) ?? "Clip lesson";
    const group = names.get(t.school_id) ?? "Class";
    const link = `${SITE}/watch/${t.film_id}`;
    const desc = [
      teaching ? `Clip due for ${group}.` : `Your teacher set this clip for ${group}.`,
      t.note ? `Note: ${t.note}` : "",
      `Watch: ${link}`,
      teaching ? `See who watched: ${SITE}/teacher/clips` : "",
    ].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:clip-${t.id}@linguascript.co.uk`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(due)}`,
      `SUMMARY:${esc(`${teaching ? "Clip due" : "Watch"}: ${title} · ${group}`)}`,
      `DESCRIPTION:${esc(desc)}`,
      `URL:${link}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="linguascript-clips.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
});
