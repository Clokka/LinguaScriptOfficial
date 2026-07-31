import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Row, Column } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader } from './brand-header.tsx'

interface Props {
  name?: string; xpGained?: number; cardsReviewed?: number; wordsLearned?: number;
  streak?: number; rank?: number | null; minutes?: number; dashboardUrl?: string
}
const PRIMARY = '#22c55e'; const ACCENT = '#16a34a'; const INK = '#0f1115'; const MUTED = '#64748b'

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Column style={{ width: '50%', padding: '8px 6px' }}>
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
      <Text style={{ color: MUTED, fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Text>
      <Text style={{ color: INK, fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>{value}</Text>
    </div>
  </Column>
)

const Email = ({ name = 'there', xpGained = 0, cardsReviewed = 0, wordsLearned = 0, streak = 0, rank = null, minutes = 0, dashboardUrl = 'https://linguascript.co.uk/browse' }: Props) => (
  <Html lang="en"><Head /><Preview>Your LinguaScript week in numbers</Preview>
    <Body style={main}><Container style={container}>
      <BrandHeader />
      <Heading style={h}>Your week in review 📈</Heading>
      <Text style={p}>Hi {name}, here's what you got done this week.</Text>
      <Section><Row><Stat label="XP gained" value={`+${xpGained}`} /><Stat label="Minutes learned" value={minutes} /></Row>
      <Row><Stat label="Cards reviewed" value={cardsReviewed} /><Stat label="Words saved" value={wordsLearned} /></Row>
      <Row><Stat label="Current streak" value={`${streak} 🔥`} /><Stat label="Global rank" value={rank ? `#${rank}` : '—'} /></Row></Section>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={dashboardUrl} style={cta}>Keep the momentum</Button>
      </Section>
      <Hr style={hr} />
      <Text style={footer}>You can unsubscribe from weekly summaries at any time using the link below.</Text>
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: 'Your LinguaScript weekly progress 📈',
  displayName: 'Weekly progress',
  previewData: { name: 'Rowan', xpGained: 420, cardsReviewed: 64, wordsLearned: 23, streak: 7, rank: 12, minutes: 95 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { color: PRIMARY, fontWeight: 700, fontSize: '18px', margin: 0 }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' }
const cta = { backgroundColor: PRIMARY, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
