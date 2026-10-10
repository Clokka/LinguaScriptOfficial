// Dispatch push notifications: the daily word-goal reminder, its follow-up
// "almost there" nudge, and friend activity. Runs every 15 min from pg_cron.
//
// Everything is timed in the learner's own time zone (profiles.timezone) and
// never lands in quiet hours, and a learner gets at most two goal pushes a
// day: the reminder at their chosen time, then — only if the goal still isn't
// met a couple of hours later — one small nudge. Streak risk and due
// flashcards ride along in the reminder text rather than being pushes of
// their own, so the phone isn't buzzing all day.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const svc = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const QUIET_START = 21 * 60 + 30; // 21:30
const QUIET_END = 8 * 60; // 08:00
const NUDGE_AFTER_MS = 2 * 60 * 60 * 1000;
const FRIEND_EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function sendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify({ user_id: userId, title, body, data, channelId }),
    });
    if (!res.ok) {
      console.warn('push fail', userId, res.status, await res.text());
    }
    return res.ok;
  } catch (e) {
    console.warn('push threw', userId, e);
    return false;
  }
}

interface LocalNow {
  date: string; // YYYY-MM-DD in the learner's zone
  minutes: number; // minutes since local midnight
  midnightUtc: Date; // start of the learner's day, as a UTC instant
}

function zoneOrDefault(tz: string | null | undefined): string {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-GB', { timeZone: tz });
      return tz;
    }
  } catch { /* invalid zone name */ }
  return 'Europe/London';
}

function localNow(tz: string, now = new Date()): LocalNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  const h = Number(parts.hour), min = Number(parts.minute), s = Number(parts.second);
  const offsetMs = Date.UTC(y, m - 1, d, h, min, s) - Math.floor(now.getTime() / 1000) * 1000;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: h * 60 + min,
    midnightUtc: new Date(Date.UTC(y, m - 1, d) - offsetMs),
  };
}

function localDateOf(iso: string | null | undefined, tz: string): string | null {
  return iso ? localNow(tz, new Date(iso)).date : null;
}

function isQuiet(minutes: number): boolean {
  return minutes >= QUIET_START || minutes < QUIET_END;
}

function parseHHMM(v: string | null | undefined, fallback = 19 * 60): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? '');
  if (!m) return fallback;
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]));
}

/** Mirrors src/lib/progressStats.ts wordGoalForVideos. */
function wordGoalForVideos(videoGoal: number): number {
  if (videoGoal <= 1) return 10;
  if (videoGoal === 2) return 20;
  return 40;
}

/** Words saved today, counted the way useDailyWordGoal counts them. */
async function wordsSavedSince(userId: string, since: Date): Promise<number> {
  const { count } = await svc
    .from('saved_words')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .lt('next_review', '2999-01-01')
    .not('film_id', 'is', null);
  return count ?? 0;
}

async function flashcardsDue(userId: string, today: string): Promise<number> {
  const { count } = await svc
    .from('saved_words')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('next_review', today);
  return count ?? 0;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Daily goal reminder + one follow-up nudge, for learners with a device.
async function processDailyGoal(): Promise<void> {
  const { data: tokens } = await svc.from('device_tokens').select('user_id').limit(5000);
  const userIds = [...new Set((tokens ?? []).map((t: any) => t.user_id as string))];
  if (!userIds.length) return;

  const [{ data: profiles }, { data: prefsRows }] = await Promise.all([
    svc
      .from('profiles')
      .select('user_id, display_name, username, timezone, daily_word_goal, daily_video_goal, streak_count, last_streak_date, last_goal_push_at, last_goal_nudge_at')
      .in('user_id', userIds),
    svc
      .from('notification_preferences')
      .select('user_id, daily_reminder_enabled, daily_reminder_time, streak_nudges, flashcards_due')
      .in('user_id', userIds),
  ]);
  const prefsByUser = new Map((prefsRows ?? []).map((p: any) => [p.user_id, p]));
  const nowMs = Date.now();

  for (const p of (profiles ?? []) as any[]) {
    const prefs: any = prefsByUser.get(p.user_id) ?? {};
    if (prefs.daily_reminder_enabled === false) continue;

    const tz = zoneOrDefault(p.timezone);
    const local = localNow(tz);
    if (isQuiet(local.minutes)) continue;

    const goal: number = p.daily_word_goal ?? wordGoalForVideos(p.daily_video_goal ?? 1);
    const remindedToday = localDateOf(p.last_goal_push_at, tz) === local.date;
    const nudgedToday = localDateOf(p.last_goal_nudge_at, tz) === local.date;

    if (!remindedToday) {
      if (local.minutes < parseHHMM(prefs.daily_reminder_time)) continue;

      const saved = await wordsSavedSince(p.user_id, local.midnightUtc);
      // Mark the day handled even when the goal is already met, so a learner
      // who studied early is never reminded and never nudged.
      await svc.from('profiles').update({ last_goal_push_at: new Date().toISOString() }).eq('user_id', p.user_id);
      if (saved >= goal) continue;

      const remaining = goal - saved;
      const name = p.display_name || p.username;
      const title = saved > 0
        ? `🦎 ${plural(remaining, 'word')} to go today`
        : `🦎 Your ${plural(goal, 'word')} for today`;
      let body = saved > 0
        ? `${name ? `${name}, you're` : "You're"} ${saved}/${goal} — one quick video finishes it.`
        : `${name ? `${name}, learn` : 'Learn'} today's ${plural(goal, 'high-frequency word')} in a quick video.`;

      const yesterday = localNow(tz, new Date(nowMs - 24 * 60 * 60 * 1000)).date;
      if (prefs.streak_nudges !== false && p.streak_count >= 2 && String(p.last_streak_date) === yesterday) {
        body += ` Keep your 🔥 ${p.streak_count}-day streak alive!`;
      }
      if (prefs.flashcards_due !== false) {
        const due = await flashcardsDue(p.user_id, local.date);
        if (due >= 5) body += ` Plus ${due} flashcards ready.`;
      }

      await sendPush(p.user_id, title, body, { kind: 'daily-goal' }, 'reminders');
      continue;
    }

    if (nudgedToday || !p.last_goal_push_at) continue;
    if (nowMs - Date.parse(p.last_goal_push_at) < NUDGE_AFTER_MS) continue;

    const saved = await wordsSavedSince(p.user_id, local.midnightUtc);
    await svc.from('profiles').update({ last_goal_nudge_at: new Date().toISOString() }).eq('user_id', p.user_id);
    const remaining = goal - saved;
    if (remaining <= 0) continue;

    const title = remaining === 1 ? '🎯 Just 1 more word!' : saved > 0 ? `🎯 Only ${remaining} more words` : '🎯 Just 1 word?';
    const body = remaining === 1
      ? "You're one word away from today's goal. Finish it in a minute!"
      : saved > 0
        ? `You're ${saved}/${goal}. A short clip gets you over the line.`
        : 'Even one new word today keeps your progress moving.';
    await sendPush(p.user_id, title, body, { kind: 'daily-goal' }, 'reminders');
  }
}

// Friend activity: push for unsent friendship_events, held back during the
// recipient's quiet hours and dropped once they're a day old.
async function processFriendPushes(): Promise<void> {
  const { data: events, error } = await svc
    .from('friendship_events')
    .select('id, recipient_id, actor_id, kind, created_at')
    .is('push_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error || !events?.length) return;

  const markSent = (id: string) =>
    svc.from('friendship_events').update({ push_sent_at: new Date().toISOString() }).eq('id', id);

  for (const ev of events as any[]) {
    if (Date.now() - Date.parse(ev.created_at) > FRIEND_EVENT_MAX_AGE_MS) {
      await markSent(ev.id);
      continue;
    }
    if (ev.kind !== 'request_received' && ev.kind !== 'request_accepted') {
      await markSent(ev.id);
      continue;
    }

    const [{ data: prefs }, { data: recipient }, { data: actor }] = await Promise.all([
      svc.from('notification_preferences').select('friend_activity').eq('user_id', ev.recipient_id).maybeSingle(),
      svc.from('profiles').select('timezone').eq('user_id', ev.recipient_id).maybeSingle(),
      svc.from('profiles').select('display_name, username').eq('user_id', ev.actor_id).maybeSingle(),
    ]);
    if ((prefs as any)?.friend_activity === false) {
      await markSent(ev.id);
      continue;
    }
    if (isQuiet(localNow(zoneOrDefault((recipient as any)?.timezone)).minutes)) continue;

    const actorName = (actor as any)?.display_name || (actor as any)?.username || 'Someone';
    const [title, body] = ev.kind === 'request_received'
      ? ['👋 New friend request', `${actorName} wants to be your language buddy!`]
      : ['🎉 Friend request accepted', `${actorName} accepted your friend request. Study together!`];

    await sendPush(ev.recipient_id, title, body, { kind: 'friend-activity' }, 'friends');
    await markSent(ev.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Same private cron header as dispatch-retention-emails: the function URL
  // is public, so without it anyone could fire pushes at real users.
  const cronSecret = Deno.env.get('RETENTION_DISPATCH_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    await processFriendPushes();
    await processDailyGoal();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('dispatch-push-notifications failed', e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
