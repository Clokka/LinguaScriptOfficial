import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface Body {
  recipient_id?: string
  body?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'unauthorized' }, 401)

  let payload: Body
  try { payload = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const recipientId = (payload.recipient_id ?? '').trim()
  const body = (payload.body ?? '').trim()
  if (!recipientId) return json({ error: 'recipient_id required' }, 400)
  if (!body) return json({ error: 'body required' }, 400)
  if (body.length > 500) return json({ error: 'body too long (max 500)' }, 400)
  if (recipientId === user.id) return json({ error: 'cannot_message_self' }, 400)

  const service = createClient(supabaseUrl, serviceKey)

  // Insert as the user (so RLS + rate-limit trigger run) via the user-scoped client
  const { data: inserted, error: insertErr } = await userClient
    .from('friend_messages')
    .insert({ sender_id: user.id, recipient_id: recipientId, body })
    .select('id, created_at')
    .single()

  if (insertErr) {
    const msg = insertErr.message || ''
    if (msg.includes('rate_limit_pair')) return json({ error: 'rate_limit_pair', message: 'You can send up to 5 messages per person per day.' }, 429)
    if (msg.includes('rate_limit_daily')) return json({ error: 'rate_limit_daily', message: 'Daily message limit reached. Try again tomorrow.' }, 429)
    console.error('insert failed', insertErr)
    return json({ error: 'insert_failed', message: msg }, 400)
  }

  // Resolve sender display name + recipient email (service role)
  const [{ data: senderProfile }, { data: recipientAuth }] = await Promise.all([
    service.from('profiles').select('username, display_name').eq('user_id', user.id).maybeSingle(),
    service.auth.admin.getUserById(recipientId),
  ])

  const senderName =
    senderProfile?.username ? `@${senderProfile.username}` :
    (senderProfile?.display_name && !senderProfile.display_name.includes('@')) ? senderProfile.display_name :
    'A LinguaScript learner'

  const recipientEmail = recipientAuth?.user?.email

  if (recipientEmail) {
    try {
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          templateName: 'friend-message-notification',
          recipientEmail,
          idempotencyKey: `msg-${inserted.id}`,
          templateData: {
            senderName,
            body,
            inboxUrl: 'https://linguascript.xyz/friends',
          },
        }),
      })
      if (!sendRes.ok) {
        const txt = await sendRes.text()
        console.warn('send-transactional-email failed', sendRes.status, txt)
      }
    } catch (e) {
      console.warn('email dispatch threw', e)
    }
  } else {
    console.log('No recipient email; message saved in-app only')
  }

  return json({ ok: true, id: inserted.id })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
