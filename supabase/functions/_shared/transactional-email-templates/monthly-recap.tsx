import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Row, Column } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader } from './brand-header.tsx'

interface Props {
  name?: string; totalMinutes?: number; wordsSaved?: number; wordsMastered?: number;
  xpGrowth?: number; longestStreak?: number; dashboardUrl?: string
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

const Email = ({ name = 'there', totalMinutes = 0, wordsSaved = 0, wordsMastered = 0, xpGrowth = 0, longestStreak = 0, dashboardUrl = 'https://linguascript.co.uk/browse' }: Props) => (
  <Html lang="en"><Head /><Preview>Look how far you've come</Preview>
    <Body style={main}><Container style={container}>
      <BrandHeader />
      <Heading style={h}>Look how far you've come 🌍</Heading>
      <Text style={p}>Hi {name}, here's your month at a glance.</Text>
      <Section><Row><Stat label="Total minutes" value={totalMinutes} /><Stat label="XP gained" value={`+${xpGrowth}`} /></Row>
      <Row><Stat label="Words saved" value={wordsSaved} /><Stat label="Words mastered" value={wordsMastered} /></Row>
      <Row><Stat label="Longest streak" value={`${longestStreak} 🔥`} /><Stat label="Keep going" value="→" /></Row></Section>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={dashboardUrl} style={cta}>Continue learning</Button>
      </Section>
      <Hr style={hr} />
      <Text style={footer}>You can unsubscribe from the monthly recap at any time using the link below.</Text>
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: 'Look how far you\'ve come 🌍',
  displayName: 'Monthly recap',
  previewData: { name: 'Rowan', totalMinutes: 380, wordsSaved: 112, wordsMastered: 48, xpGrowth: 2100, longestStreak: 14 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { color: PRIMARY, fontWeight: 700, fontSize: '18px', margin: 0 }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' }
const cta = { backgroundColor: PRIMARY, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
