import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader } from './brand-header.tsx'

interface Props {
  senderName?: string
  body?: string
  inboxUrl?: string
}

const PRIMARY = '#6366f1'
const ACCENT = '#f97316'
const INK = '#0f172a'
const MUTED = '#64748b'

const Email = ({
  senderName = 'A LinguaScript learner',
  body = '',
  inboxUrl = 'https://linguascript.xyz/friends',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${senderName} sent you a message on LinguaScript`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>You have a new message</Heading>
        <Text style={lead}>
          <strong style={{ color: INK }}>{senderName}</strong> sent you a message
          on LinguaScript.
        </Text>
        <Section style={quote}>
          <Text style={quoteText}>{body || '(no message)'}</Text>
        </Section>
        <Section style={{ textAlign: 'center', padding: '24px 0' }}>
          <Button href={inboxUrl} style={cta}>Reply on LinguaScript</Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          You're receiving this because someone on LinguaScript messaged you.
          Sign in to reply or change notification settings.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `${d?.senderName ?? 'Someone'} sent you a message on LinguaScript`,
  displayName: 'Friend message notification',
  previewData: {
    senderName: '@rowanawesome1',
    body: 'Hey! Want to race me to 1000 XP this week?',
    inboxUrl: 'https://linguascript.xyz/friends',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { color: PRIMARY, fontWeight: 700, fontSize: '18px', letterSpacing: '-0.01em', margin: 0 }
const heading = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const lead = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' }
const quote = {
  backgroundColor: '#f8fafc',
  borderLeft: `3px solid ${ACCENT}`,
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '8px 0',
}
const quoteText = { color: INK, fontSize: '15px', lineHeight: '24px', margin: 0, whiteSpace: 'pre-wrap' as const }
const cta = {
  backgroundColor: PRIMARY,
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '10px',
  fontWeight: 600,
  fontSize: '15px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
