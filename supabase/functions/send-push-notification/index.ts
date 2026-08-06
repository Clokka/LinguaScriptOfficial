// Send a push notification via the Expo Push API to one user's registered devices.
//
// Request body:
//   { user_id: string, title: string, body: string, data?: object, channelId?: string }
//
// Auth: caller must present the service-role key OR a Bearer token whose user
// matches user_id (so a user can push to their own devices for testing).
//
// This function looks up the user's device_tokens rows, posts to
// https://exp.host/--/api/v2/push/send in chunks of 100, and returns the
// aggregated Expo response. Invalid tokens (DeviceNotRegistered) are pruned.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Payload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: 'default' | null;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: 'default' | null;
  priority: 'high';
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const auth = req.headers.get('Authorization') ?? '';
  const isService = auth === `Bearer ${serviceKey}`;

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!payload.user_id) return json({ error: 'user_id required' }, 400);
  if (!payload.title || !payload.body) return json({ error: 'title and body required' }, 400);

  // If not service-role, verify caller owns user_id.
  if (!isService) {
    if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user || user.id !== payload.user_id) {
      return json({ error: 'forbidden' }, 403);
    }
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: tokens, error } = await admin
    .from('device_tokens')
    .select('id, expo_push_token, platform')
    .eq('user_id', payload.user_id);

  if (error) return json({ error: error.message }, 500);
  if (!tokens || tokens.length === 0) return json({ sent: 0, tickets: [] });

  const messages: ExpoMessage[] = tokens.map((t) => ({
    to: t.expo_push_token as string,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    channelId: payload.channelId ?? 'reminders',
    sound: payload.sound === null ? null : 'default',
    priority: 'high',
  }));

  const tickets: unknown[] = [];
  const invalidTokens: string[] = [];

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      const body = await resp.json();
      tickets.push(body);
      const data = Array.isArray(body?.data) ? body.data : [];
      data.forEach((ticket: any, idx: number) => {
        if (
          ticket?.status === 'error' &&
          (ticket.details?.error === 'DeviceNotRegistered' ||
            ticket.message?.includes('not a registered push notification recipient'))
        ) {
          invalidTokens.push(chunk[idx].to);
        }
      });
    } catch (e) {
      tickets.push({ error: String(e) });
    }
  }

  if (invalidTokens.length > 0) {
    await admin.from('device_tokens').delete().in('expo_push_token', invalidTokens);
  }

  return json({
    sent: messages.length - invalidTokens.length,
    invalid_pruned: invalidTokens.length,
    tickets,
  });
});
