import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandFooterMark, BrandHeader } from './brand-header.tsx'

// Sent once per invoice when a Pro renewal charge fails. Stripe keeps
// retrying the card on its own schedule; this just tells the customer so
// they can fix it before Pro lapses. Triggered by payments-webhook.
interface Props { name?: string; billingUrl?: string }

const ACCENT = '#16a34a'; const INK = '#0f1115'; const MUTED = '#64748b'

const Email = ({ name = 'there', billingUrl = 'https://linguascript.co.uk/profile' }: Props) => (
  <Html lang="en"><Head /><Preview>We couldn't renew your LinguaScript Pro</Preview>
    <Body style={main}><Container style={container}>
      <BrandHeader />
      <Heading style={h}>We couldn't renew your Pro plan</Heading>
      <Text style={p}>Hi {name}, we tried to charge your card for <strong style={{ color: ACCENT }}>LinguaScript Pro</strong>, but the payment was declined.</Text>
      <Text style={p}>We'll try again automatically over the next few days. To keep Pro without interruption, please check or update your card:</Text>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={billingUrl} style={cta}>Update payment method</Button>
      </Section>
      <Text style={p}>Open your profile and tap <strong>Manage billing</strong>. If you need help, just reply to this email.</Text>
      <Hr style={hr} />
      <Text style={footer}>You're getting this because a payment for your LinguaScript Pro subscription failed.</Text>
      <BrandFooterMark />
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: "Action needed: your LinguaScript Pro payment failed",
  displayName: 'Renewal payment failed',
  previewData: { name: 'Rowan', billingUrl: 'https://linguascript.co.uk/profile' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 8px' }
const cta = { backgroundColor: ACCENT, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
