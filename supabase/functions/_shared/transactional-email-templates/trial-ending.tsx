import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandFooterMark, BrandHeader } from './brand-header.tsx'

// The reminder promised on the trial timeline: sent three days before a
// 14-day Pro trial turns into a paid plan. Triggered by payments-webhook
// (customer.subscription.trial_will_end). Plain and honest — no pressure.
interface Props { name?: string; endDate?: string; manageUrl?: string }

const ACCENT = '#16a34a'; const INK = '#0f1115'; const MUTED = '#64748b'

const Email = ({ name = 'there', endDate = 'in 3 days', manageUrl = 'https://linguascript.co.uk/profile' }: Props) => (
  <Html lang="en"><Head /><Preview>Your LinguaScript Pro trial ends {endDate}</Preview>
    <Body style={main}><Container style={container}>
      <BrandHeader />
      <Heading style={h}>Your free trial ends {endDate}</Heading>
      <Text style={p}>Hi {name}, this is the reminder we promised. Your <strong style={{ color: ACCENT }}>LinguaScript Pro</strong> trial ends on {endDate}, and then your plan starts.</Text>
      <Text style={p}>Want to keep going? You don't need to do anything. Not for you? Cancel in one tap from your profile and you won't be charged.</Text>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={manageUrl} style={cta}>Manage my plan</Button>
      </Section>
      <Hr style={hr} />
      <Text style={footer}>You're getting this because you started a LinguaScript Pro free trial.</Text>
      <BrandFooterMark />
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: (data: Props) => `Your LinguaScript Pro trial ends ${data?.endDate ?? 'in 3 days'}`,
  displayName: 'Trial ending',
  previewData: { name: 'Rowan', endDate: '21 October', manageUrl: 'https://linguascript.co.uk/profile' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 8px' }
const cta = { backgroundColor: ACCENT, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
