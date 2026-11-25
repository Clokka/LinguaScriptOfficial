// Sends one email through Resend (https://resend.com/docs/api-reference/emails/send-email).
// Replaces Lovable's email API, which stopped with the Lovable Cloud backend.
// Needs the RESEND_API_KEY secret; the "from" domain must be verified in Resend.
//
// Every marketing/transactional email gets an unsubscribe link (footer + the
// List-Unsubscribe headers Gmail/Yahoo require for one-click unsubscribe).
// Errors carry .status (429/403 handled by process-email-queue) and
// .retryAfterSeconds.

const SITE = 'https://linguascript.co.uk'

export interface OutgoingEmail {
  to: string
  from: string
  subject: string
  html: string
  text?: string
  unsubscribe_token?: string
  idempotency_key?: string
  label?: string
}

export class ResendError extends Error {
  constructor(message: string, public status: number, public retryAfterSeconds: number | null = null) {
    super(message)
  }
}

export function hasResend(): boolean {
  return !!Deno.env.get('RESEND_API_KEY')
}

function withUnsubscribe(email: OutgoingEmail): { html: string; text?: string; headers: Record<string, string> } {
  const token = email.unsubscribe_token
  if (!token) return { html: email.html, text: email.text, headers: {} }
  const page = `${SITE}/unsubscribe?token=${encodeURIComponent(token)}`
  const oneClick = `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`
  const footer =
    `<p style="color:#64748b;font-size:12px;line-height:18px;text-align:center;margin:24px 0 0;font-family:Inter,-apple-system,sans-serif">` +
    `LinguaScript · <a href="${SITE}" style="color:#64748b">linguascript.co.uk</a> · ` +
    `<a href="${page}" style="color:#64748b">Unsubscribe</a></p>`
  const html = email.html.includes('</body>') ? email.html.replace('</body>', `${footer}</body>`) : email.html + footer
  const text = email.text ? `${email.text}\n\n—\nUnsubscribe: ${page}` : undefined
  return {
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${oneClick}>, <${page}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

export async function sendWithResend(email: OutgoingEmail): Promise<{ id: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new ResendError('RESEND_API_KEY is not set', 500)
  // Optional override, e.g. "LinguaScript <hello@linguascript.co.uk>".
  const from = Deno.env.get('EMAIL_FROM') || email.from
  const { html, text, headers } = withUnsubscribe(email)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(email.idempotency_key ? { 'Idempotency-Key': email.idempotency_key.slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html,
      ...(text ? { text } : {}),
      headers,
      ...(email.label ? { tags: [{ name: 'template', value: email.label.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256) }] } : {}),
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const retry = Number(res.headers.get('retry-after'))
    throw new ResendError(
      `Resend ${res.status}: ${body?.message || body?.name || res.statusText}`,
      res.status,
      Number.isFinite(retry) && retry > 0 ? retry : null,
    )
  }
  return { id: body.id }
}
