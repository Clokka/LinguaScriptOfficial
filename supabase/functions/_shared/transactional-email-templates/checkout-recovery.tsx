import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandFooterMark, BrandHeader } from './brand-header.tsx'

// Sent once when a Stripe Checkout Session expires unpaid — the card was
// declined, or the buyer left before finishing. Triggered by payments-webhook.
interface Props { name?: string; retryUrl?: string }

const ACCENT = '#16a34a'; const INK = '#0f1115'; const MUTED = '#64748b'

const Email = ({ name = 'there', retryUrl = 'https://linguascript.co.uk/upgrade' }: Props) => (
  <Html lang="en"><Head /><Preview>Your LinguaScript Pro payment didn't go through</Preview>
    <Body style={main}><Container style={container}>
      <BrandHeader />
      <Heading style={h}>Your payment didn't go through</Heading>
      <Text style={p}>Hi {name}, you started upgrading to <strong style={{ color: ACCENT }}>LinguaScript Pro</strong>, but the payment wasn't completed. Nothing was charged.</Text>
      <Text style={p}>This usually happens when a bank declines the card, the card details had a typo, or the page was closed early. You can try again with the same card or a different one:</Text>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={retryUrl} style={cta}>Finish upgrading</Button>
      </Section>
      <Text style={p}>If it keeps failing, reply to this email and we'll help you sort it out.</Text>
      <Hr style={hr} />
      <Text style={footer}>You're getting this one-time email because you started a checkout on LinguaScript.</Text>
      <BrandFooterMark />
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: "Your LinguaScript Pro payment didn't go through",
  displayName: 'Checkout recovery',
  previewData: { name: 'Rowan', retryUrl: 'https://linguascript.co.uk/upgrade' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 8px' }
const cta = { backgroundColor: ACCENT, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
