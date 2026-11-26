// Supabase "Send Email" auth hook → LinguaScript-branded login emails via Resend.
//
// Supabase calls this function instead of its own mailer for sign-up
// confirmation, password reset, magic link, invite, email change and
// re-authentication codes (Authentication → Hooks → Send Email). It was wired to
// Lovable's email service, which stopped with the Lovable Cloud backend.
//
// Secrets: SEND_EMAIL_HOOK_SECRET ("v1,whsec_…", the same value as the hook's
// secret in the auth config), RESEND_API_KEY, optional EMAIL_FROM.
// Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'
import { sendWithResend } from '../_shared/resend.ts'

const SITE_NAME = 'LinguaScript'
const SITE = 'https://linguascript.co.uk'
const FROM = `${SITE_NAME} <noreply@linguascript.co.uk>`

const SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited to LinguaScript",
  magiclink: 'Your LinguaScript login link',
  recovery: 'Reset your LinguaScript password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your LinguaScript verification code',
}

const TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

interface EmailData {
  token: string
  token_hash: string
  redirect_to: string
  email_action_type: string
  site_url: string
  token_new?: string
  token_hash_new?: string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Only our own pages may be the landing page after a link.
function safeRedirect(redirectTo: string | undefined, fallback: string): string {
  try {
    const u = new URL(redirectTo || fallback)
    if (/^(www\.)?linguascript\.co\.uk$/.test(u.hostname) || u.protocol === 'linguascript:') return u.toString()
  } catch { /* fall through */ }
  return fallback
}

// Recovery links open our own page (no Supabase address in the email, and the
// one-time token is only used when the learner presses Save on the page).
function linkFor(type: string, tokenHash: string, redirectTo: string): string {
  if (type === 'recovery') {
    const u = new URL('/reset-password', SITE)
    u.searchParams.set('token_hash', tokenHash)
    u.searchParams.set('type', 'recovery')
    return u.toString()
  }
  const u = new URL('/auth/v1/verify', Deno.env.get('SUPABASE_URL')!)
  u.searchParams.set('token', tokenHash)
  u.searchParams.set('type', type)
  u.searchParams.set('redirect_to', safeRedirect(redirectTo, `${SITE}/discover`))
  return u.toString()
}

async function sendOne(to: string, type: string, props: Record<string, unknown>) {
  const Template = TEMPLATES[type]
  const element = React.createElement(Template, props)
  const html = await renderAsync(element)
  const text = await renderAsync(element, { plainText: true })
  return sendWithResend({ to, from: FROM, subject: SUBJECTS[type] || SITE_NAME, html, text, label: `auth-${type}` })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!secret) {
    console.error('SEND_EMAIL_HOOK_SECRET is not set')
    return json(500, { error: { http_code: 500, message: 'Email hook is not configured' } })
  }

  // 1. Only Supabase Auth may call this (standard-webhooks signature).
  const raw = await req.text()
  let payload: { user: { email: string; new_email?: string }; email_data: EmailData }
  try {
    const wh = new Webhook(secret.replace(/^v1,whsec_/, ''))
    payload = wh.verify(raw, Object.fromEntries(req.headers)) as typeof payload
  } catch (e) {
    console.error('Invalid hook signature', String(e))
    return json(401, { error: { http_code: 401, message: 'Invalid signature' } })
  }

  const { user, email_data: d } = payload
  const type = d?.email_action_type
  if (!user?.email || !type || !TEMPLATES[type]) {
    console.error('Unsupported email', { type })
    return json(400, { error: { http_code: 400, message: `Unsupported email type: ${type}` } })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const base = { siteName: SITE_NAME, siteUrl: SITE }

  // Secure email change sends two emails: one to the old address (token_hash_new)
  // and one to the new address (token_hash) — Supabase's documented pairing.
  const jobs: { to: string; props: Record<string, unknown> }[] = []
  if (type === 'email_change' && user.new_email && d.token_hash_new) {
    jobs.push({ to: user.email, props: { ...base, email: user.email, oldEmail: user.email, newEmail: user.new_email, confirmationUrl: linkFor(type, d.token_hash_new, d.redirect_to) } })
    jobs.push({ to: user.new_email, props: { ...base, email: user.new_email, oldEmail: user.email, newEmail: user.new_email, confirmationUrl: linkFor(type, d.token_hash, d.redirect_to) } })
  } else {
    jobs.push({
      to: type === 'email_change' && user.new_email ? user.new_email : user.email,
      props: {
        ...base,
        recipient: user.email,
        email: user.email,
        oldEmail: user.email,
        newEmail: user.new_email,
        token: d.token,
        confirmationUrl: linkFor(type, d.token_hash, d.redirect_to),
      },
    })
  }

  for (const job of jobs) {
    try {
      const { id } = await sendOne(job.to, type, job.props)
      await supabase.from('email_send_log').insert({ message_id: id, template_name: `auth-${type}`, recipient_email: job.to, status: 'sent' })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Auth email failed', { type, message })
      await supabase.from('email_send_log').insert({ template_name: `auth-${type}`, recipient_email: job.to, status: 'failed', error_message: message.slice(0, 1000) })
      return json(500, { error: { http_code: 500, message: "We couldn't send the email. Please try again in a minute." } })
    }
  }

  return json(200, {})
})
