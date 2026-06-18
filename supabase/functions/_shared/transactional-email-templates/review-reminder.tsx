import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string; cardCount?: number; languageLabel?: string; reviewUrl?: string }

const PRIMARY = '#6366f1'; const ACCENT = '#f97316'; const INK = '#0f172a'; const MUTED = '#64748b'

const Email = ({ name = 'there', cardCount = 0, languageLabel = 'Your', reviewUrl = 'https://linguascript.xyz/flashcards' }: Props) => (
  <Html lang="en"><Head /><Preview>{`${cardCount} cards ready for review`}</Preview>
    <Body style={main}><Container style={container}>
      <Text style={brand}>LinguaScript</Text>
      <Heading style={h}>Your {languageLabel} words are waiting</Heading>
      <Text style={p}>Hi {name}, you have <strong style={{ color: ACCENT }}>{cardCount} flashcards</strong> ready for review. Five focused minutes today keeps everything you've learned this week.</Text>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={reviewUrl} style={cta}>Start reviewing</Button>
      </Section>
      <Hr style={hr} />
      <Text style={footer}>We only email you when there's real review work waiting — never more than 3 review reminders a week. If you don't want these emails, you can unsubscribe below.</Text>
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `You have ${d?.cardCount ?? ''} cards ready for review`.trim(),
  displayName: 'Review reminder',
  previewData: { name: 'Rowan', cardCount: 12, languageLabel: 'French', reviewUrl: 'https://linguascript.xyz/flashcards' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { color: PRIMARY, fontWeight: 700, fontSize: '18px', margin: 0 }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 8px' }
const cta = { backgroundColor: PRIMARY, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
