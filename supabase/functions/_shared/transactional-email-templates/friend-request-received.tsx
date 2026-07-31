import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader } from './brand-header.tsx'

interface Props { senderName?: string; friendsUrl?: string }
const PRIMARY = '#22c55e'; const INK = '#0f1115'; const MUTED = '#64748b'

const Email = ({ senderName = 'A LinguaScript learner', friendsUrl = 'https://linguascript.co.uk/friends' }: Props) => (
  <Html lang="en"><Head /><Preview>{`${senderName} wants to be your friend on LinguaScript`}</Preview>
    <Body style={main}><Container style={container}>
      <BrandHeader />
      <Heading style={h}>New friend request</Heading>
      <Text style={p}><strong>{senderName}</strong> wants to be your friend on LinguaScript. Friends appear on your private leaderboard so you can race each other to fluency.</Text>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={friendsUrl} style={cta}>Accept on LinguaScript</Button>
      </Section>
      <Hr style={hr} />
      <Text style={footer}>You can unsubscribe from friend notifications at any time using the link below.</Text>
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `${d?.senderName ?? 'Someone'} sent you a friend request`,
  displayName: 'Friend request received',
  previewData: { senderName: '@rowanawesome1', friendsUrl: 'https://linguascript.co.uk/friends' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { color: PRIMARY, fontWeight: 700, fontSize: '18px', margin: 0 }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 8px' }
const cta = { backgroundColor: PRIMARY, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
