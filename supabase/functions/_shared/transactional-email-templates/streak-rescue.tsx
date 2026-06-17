import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string; streak?: number; watchUrl?: string }

const PRIMARY = '#6366f1'; const ACCENT = '#f97316'; const INK = '#0f172a'; const MUTED = '#64748b'

const Email = ({ name = 'there', streak = 0, watchUrl = 'https://linguascript.xyz/browse' }: Props) => (
  <Html lang="en"><Head /><Preview>Don't lose your streak</Preview>
    <Body style={main}><Container style={container}>
      <Text style={brand}>LinguaScript</Text>
      <Heading style={h}>Don't lose your {streak}-day streak 🔥</Heading>
      <Text style={p}>Hi {name}, your <strong style={{ color: ACCENT }}>{streak}-day streak</strong> ends in a few hours. One short video is all it takes to keep it alive.</Text>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={watchUrl} style={cta}>Watch something now</Button>
      </Section>
      <Hr style={hr} />
      <Text style={footer}>You'll only ever get one streak-rescue email per streak.</Text>
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Your ${d?.streak ?? ''}-day streak is in danger 🔥`,
  displayName: 'Streak rescue',
  previewData: { name: 'Rowan', streak: 7, watchUrl: 'https://linguascript.xyz/browse' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { color: PRIMARY, fontWeight: 700, fontSize: '18px', margin: 0 }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 8px' }
const cta = { backgroundColor: ACCENT, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
