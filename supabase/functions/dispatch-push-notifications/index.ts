// Dispatch push notifications for streak nudges, flashcard reminders, and friend events.
// Runs on the same pg_cron cadence as dispatch-retention-emails (every 15 min).
// Each category is independently throttled so retries are safe.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const svc = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function prefEnabled(prefs: any, key: string): boolean {
  if (!prefs || typeof prefs !== 'object') return true;
  return prefs[key] !== false;
}

// Streak nudges: fire once per day for users whose streak will break today
// (last_streak_date = yesterday, streak >= 1).
async function processStreakNudges(): Promise<void> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const throttleMs = 20 * 60 * 60 * 1000; // 20 h

  const { data: rows, error } = await svc
    .from('profiles')
    .select('user_id, display_name, username, streak_count, last_streak_date, last_streak_push_at')
    .gte('streak_count', 1)
    .limit(1000);

  if (error || !rows?.length) return;

  const nowMs = Date.now();

  for (const p of rows as any[]) {
    if (String(p.last_streak_date) !== yesterdayStr) continue;

    const lastPush = p.last_streak_push_at ? Date.parse(p.last_streak_push_at) : 0;
    if (nowMs - lastPush < throttleMs) continue;

    const { data: prefs } = await svc
      .from('notification_preferences')
      .select('streak_nudges')
      .eq('user_id', p.user_id)
      .maybeSingle();
    if (!prefEnabled(prefs, 'streak_nudges')) continue;

    const streak = p.streak_count as number;
    const name = p.display_name || p.username || 'there';
    const ok = await sendPush(
      p.user_id,
      '🔥 Your streak is at risk!',
      `${name}, your ${streak}-day streak breaks tonight. Jump in for just 5 minutes.`,
      { kind: 'streak-nudge' },
      'streak',
    );

    if (ok) {
      await svc
        .from('profiles')
        .update({ last_streak_push_at: new Date().toISOString() })
        .eq('user_id', p.user_id);
    }
  }
}

// Flashcard reminders: fire once per day for users with >= 5 due cards.
async function processFlashcardsDue(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const throttleMs = 23 * 60 * 60 * 1000; // 23 h

  const { data: rows, error } = await svc
    .from('profiles')
    .select('user_id, display_name, username, last_flashcard_push_at')
    .limit(1000);

  if (error || !rows?.length) return;

  const nowMs = Date.now();

  for (const p of rows as any[]) {
    const lastPush = p.last_flashcard_push_at ? Date.parse(p.last_flashcard_push_at) : 0;
    if (nowMs - lastPush < throttleMs) continue;

    const { data: prefs } = await svc
      .from('notification_preferences')
      .select('flashcards_due')
      .eq('user_id', p.user_id)
      .maybeSingle();
    if (!prefEnabled(prefs, 'flashcards_due')) continue;

    const { count: dueCount } = await svc
      .from('saved_words')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', p.user_id)
      .lte('next_review', today);

    if (!dueCount || dueCount < 5) continue;

    const ok = await sendPush(
      p.user_id,
      '🃏 Flashcards waiting',
      `You have ${dueCount} card${dueCount === 1 ? '' : 's'} ready for review. Quick session?`,
      { kind: 'flashcards-due' },
      'flashcards',
    );

    if (ok) {
      await svc
        .from('profiles')
        .update({ last_flashcard_push_at: new Date().toISOString() })
        .eq('user_id', p.user_id);
    }
  }
}

// Friend activity: push for unacknowledged friendship_events.
async function processFriendPushes(): Promise<void> {
  const { data: events, error } = await svc
    .from('friendship_events')
    .select('id, recipient_id, actor_id, kind')
    .is('push_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error || !events?.length) return;

  for (const ev of events as any[]) {
    const { data: prefs } = await svc
      .from('notification_preferences')
      .select('friend_activity')
      .eq('user_id', ev.recipient_id)
      .maybeSingle();
    if (!prefEnabled(prefs, 'friend_activity')) {
      // Mark as handled so we don't retry
      await svc.from('friendship_events').update({ push_sent_at: new Date().toISOString() }).eq('id', ev.id);
      continue;
    }

    const { data: actor } = await svc
      .from('profiles')
      .select('display_name, username')
      .eq('user_id', ev.actor_id)
      .maybeSingle();
    const actorName = (actor as any)?.display_name || (actor as any)?.username || 'Someone';

    let title = '';
    let body = '';
    if (ev.kind === 'request_received') {
      title = '👋 New friend request';
      body = `${actorName} wants to be your language buddy!`;
    } else if (ev.kind === 'request_accepted') {
      title = '🎉 Friend request accepted';
      body = `${actorName} accepted your friend request. Study together!`;
    } else {
      await svc.from('friendship_events').update({ push_sent_at: new Date().toISOString() }).eq('id', ev.id);
      continue;
    }

    await sendPush(ev.recipient_id, title, body, { kind: 'friend-activity' }, 'friends');
    await svc.from('friendship_events').update({ push_sent_at: new Date().toISOString() }).eq('id', ev.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    await processFriendPushes();
    await processStreakNudges();
    await processFlashcardsDue();
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
