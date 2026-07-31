// Retention email dispatcher.
// Triggered every 15 minutes by pg_cron. Idempotent and conservative.
// Caps: review reminders ≤ 1 per 48h and ≤ 3/week. Streak rescue ≤ 1 per streak.
// Weekly: Sundays UTC. Monthly: 1st UTC. Friendship events fire immediately.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const svc = createClient(SUPABASE_URL, SERVICE_KEY)

async function sendTemplate(templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY },
      body: JSON.stringify({ templateName, recipientEmail, idempotencyKey, templateData }),
    })
    if (!res.ok) console.warn('send fail', templateName, res.status, await res.text())
    return res.ok
  } catch (e) { console.warn('send threw', templateName, e); return false }
}

async function emailFor(userId: string): Promise<string | null> {
  const { data } = await svc.auth.admin.getUserById(userId)
  return data?.user?.email ?? null
}

function safeName(p: any): string {
  if (p?.username) return `@${p.username}`
  if (p?.display_name && !String(p.display_name).includes('@')) return p.display_name
  return 'A LinguaScript learner'
}

function prefAllows(prefs: any, key: string): boolean {
  if (!prefs || typeof prefs !== 'object') return true
  return prefs[key] !== false
}

// ---------- Friendship events ----------
async function processFriendEvents() {
  const { data: events } = await svc
    .from('friendship_events')
    .select('id, recipient_id, actor_id, kind')
    .is('email_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(50)
  if (!events?.length) return

  for (const ev of events) {
    const [{ data: recipient }, { data: actor }] = await Promise.all([
      svc.from('profiles').select('user_id, username, display_name, email_prefs').eq('user_id', ev.recipient_id).maybeSingle(),
      svc.from('profiles').select('user_id, username, display_name').eq('user_id', ev.actor_id).maybeSingle(),
    ])
    await svc.from('friendship_events').update({ email_sent_at: new Date().toISOString() }).eq('id', ev.id)
    if (!recipient) continue
    if (!prefAllows(recipient.email_prefs, 'friend_requests')) continue
    const email = await emailFor(ev.recipient_id); if (!email) continue
    const actorName = safeName(actor)
    if (ev.kind === 'request_received') {
      await sendTemplate('friend-request-received', email, `friend-req-${ev.id}`, { senderName: actorName, friendsUrl: 'https://linguascript.co.uk/friends' })
    } else if (ev.kind === 'request_accepted') {
      await sendTemplate('friend-request-accepted', email, `friend-acc-${ev.id}`, { friendName: actorName, friendsUrl: 'https://linguascript.co.uk/friends' })
    }
  }
}

// ---------- Review reminders ----------
async function processReviewReminders() {
  // Find users with >=5 due saved_words, inactive 24h+, last_review_email_at NULL or >48h ago, week count <3.
  const today = new Date().toISOString().slice(0, 10)
  const { data: candidates } = await svc.rpc('get_review_reminder_candidates' as any).select?.() ?? { data: null }

  // Fallback inline query if rpc not present
  const { data: rows } = candidates ? { data: candidates } : await svc
    .from('profiles')
    .select('user_id, display_name, username, email_prefs, last_review_email_at, review_emails_week_count, review_emails_week_start, learning_language')
    .limit(500)
  if (!rows?.length) return

  const now = Date.now()
  for (const p of rows) {
    if (!prefAllows((p as any).email_prefs, 'review_reminders')) continue
    const last = (p as any).last_review_email_at ? Date.parse((p as any).last_review_email_at) : 0
    if (now - last < 48 * 3600 * 1000) continue
    // Week window reset
    const weekStart = (p as any).review_emails_week_start
    let weekCount = (p as any).review_emails_week_count ?? 0
    const currentWeekStart = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0,10) })()
    if (weekStart !== currentWeekStart) weekCount = 0
    if (weekCount >= 3) continue

    const { count: dueCount } = await svc.from('saved_words').select('id', { count: 'exact', head: true })
      .eq('user_id', (p as any).user_id).lte('next_review', today)
    if (!dueCount || dueCount < 5) continue

    const email = await emailFor((p as any).user_id); if (!email) continue
    const ok = await sendTemplate('review-reminder', email, `review-${(p as any).user_id}-${today}`, {
      name: safeName(p), cardCount: dueCount, languageLabel: 'Your',
      reviewUrl: 'https://linguascript.co.uk/flashcards',
    })
    if (ok) {
      await svc.from('profiles').update({
        last_review_email_at: new Date().toISOString(),
        review_emails_week_count: weekCount + 1,
        review_emails_week_start: currentWeekStart,
      }).eq('user_id', (p as any).user_id)
    }
  }
}

// ---------- Streak rescue ----------
async function processStreakRescue() {
  // Send when streak >=3 and last_streak_date is yesterday (so today's a rescue day).
  const { data: rows } = await svc.from('profiles')
    .select('user_id, display_name, username, email_prefs, streak_count, streak_rescue_for_streak, last_streak_date')
    .gte('streak_count', 3).limit(500)
  if (!rows?.length) return
  const today = new Date(); today.setUTCHours(0,0,0,0)
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000).toISOString().slice(0,10)
  for (const p of rows as any[]) {
    if (!prefAllows(p.email_prefs, 'streak_rescue')) continue
    if (p.streak_rescue_for_streak === p.streak_count) continue
    if (!p.last_streak_date) continue
    if (String(p.last_streak_date) !== yesterday) continue
    const email = await emailFor(p.user_id); if (!email) continue
    const ok = await sendTemplate('streak-rescue', email, `streak-${p.user_id}-${p.streak_count}`, {
      name: safeName(p), streak: p.streak_count, watchUrl: 'https://linguascript.co.uk/browse',
    })
    if (ok) await svc.from('profiles').update({ streak_rescue_for_streak: p.streak_count, last_streak_rescue_email_at: new Date().toISOString() }).eq('user_id', p.user_id)
  }
}

// ---------- Weekly / monthly ----------
async function processWeekly() {
  const now = new Date()
  if (now.getUTCDay() !== 0) return // Sundays only
  if (now.getUTCHours() < 17) return // ~5pm UTC
  const { data: rows } = await svc.from('profiles')
    .select('user_id, display_name, username, email_prefs, xp_total, streak_count, last_weekly_email_at').limit(2000)
  if (!rows?.length) return
  const sixDaysAgo = Date.now() - 6 * 24 * 3600 * 1000
  for (const p of rows as any[]) {
    if (!prefAllows(p.email_prefs, 'weekly_report')) continue
    const last = p.last_weekly_email_at ? Date.parse(p.last_weekly_email_at) : 0
    if (last > sixDaysAgo) continue
    // require any xp this week
    const weekStartIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const { data: xpRows } = await svc.from('xp_events').select('amount').eq('user_id', p.user_id).gte('created_at', weekStartIso)
    const xpGained = (xpRows ?? []).reduce((a, r: any) => a + (r.amount || 0), 0)
    if (xpGained <= 0) continue
    // cards reviewed this week: approximate via xp_events count (schema-tolerant)
    let cardsReviewed = 0
    try {
      const { count } = await svc.from('xp_events').select('id', { count: 'exact', head: true })
        .eq('user_id', p.user_id).gte('created_at', weekStartIso)
      cardsReviewed = count ?? 0
    } catch { /* ignore */ }
    const { count: wordsLearned } = await svc.from('saved_words').select('id', { count: 'exact', head: true })
      .eq('user_id', p.user_id).gte('created_at', weekStartIso)
    const email = await emailFor(p.user_id); if (!email) continue
    const ok = await sendTemplate('weekly-progress', email, `weekly-${p.user_id}-${weekStartIso.slice(0,10)}`, {
      name: safeName(p), xpGained, cardsReviewed: cardsReviewed ?? 0, wordsLearned: wordsLearned ?? 0,
      streak: p.streak_count ?? 0, rank: null, minutes: 0,
      dashboardUrl: 'https://linguascript.co.uk/browse',
    })
    if (ok) await svc.from('profiles').update({ last_weekly_email_at: new Date().toISOString() }).eq('user_id', p.user_id)
  }
}

async function processMonthly() {
  const now = new Date()
  if (now.getUTCDate() !== 1) return
  if (now.getUTCHours() < 17) return
  const { data: rows } = await svc.from('profiles')
    .select('user_id, display_name, username, email_prefs, last_monthly_email_at').limit(2000)
  if (!rows?.length) return
  const monthAgoIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  for (const p of rows as any[]) {
    if (!prefAllows(p.email_prefs, 'monthly_report')) continue
    const last = p.last_monthly_email_at ? Date.parse(p.last_monthly_email_at) : 0
    if (Date.now() - last < 25 * 24 * 3600 * 1000) continue
    const { data: xpRows } = await svc.from('xp_events').select('amount').eq('user_id', p.user_id).gte('created_at', monthAgoIso)
    const xpGrowth = (xpRows ?? []).reduce((a, r: any) => a + (r.amount || 0), 0)
    if (xpGrowth <= 0) continue
    const { count: wordsSaved } = await svc.from('saved_words').select('id', { count: 'exact', head: true })
      .eq('user_id', p.user_id).gte('created_at', monthAgoIso)
    const { count: wordsMastered } = await svc.from('saved_words').select('id', { count: 'exact', head: true })
      .eq('user_id', p.user_id).eq('state', 'green')
    const email = await emailFor(p.user_id); if (!email) continue
    const ok = await sendTemplate('monthly-recap', email, `monthly-${p.user_id}-${now.toISOString().slice(0,7)}`, {
      name: safeName(p), totalMinutes: 0, wordsSaved: wordsSaved ?? 0,
      wordsMastered: wordsMastered ?? 0, xpGrowth, longestStreak: 0,
      dashboardUrl: 'https://linguascript.co.uk/browse',
    })
    if (ok) await svc.from('profiles').update({ last_monthly_email_at: new Date().toISOString() }).eq('user_id', p.user_id)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    await processFriendEvents()
    await processReviewReminders()
    await processStreakRescue()
    await processWeekly()
    await processMonthly()
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    console.error('dispatch failed', e)
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
