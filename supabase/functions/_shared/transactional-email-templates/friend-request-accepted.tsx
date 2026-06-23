import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader } from './brand-header.tsx'

interface Props { friendName?: string; friendsUrl?: string }
const PRIMARY = '#6366f1'; const ACCENT = '#f97316'; const INK = '#0f172a'; const MUTED = '#64748b'

const Email = ({ friendName = 'A learner', friendsUrl = 'https://linguascript.xyz/friends' }: Props) => (
  <Html lang="en"><Head /><Preview>{`${friendName} accepted your friend request`}</Preview>
    <Body style={main}><Container style={container}>
      <BrandHeader />
      <Heading style={h}>You're now friends with {friendName} 🎉</Heading>
      <Text style={p}>They'll show up on your friends leaderboard — see who's ahead on XP, streaks and words learned this week.</Text>
      <Section style={{ textAlign: 'center', padding: '24px 0' }}>
        <Button href={friendsUrl} style={cta}>View leaderboard</Button>
      </Section>
      <Hr style={hr} />
      <Text style={footer}>You can unsubscribe from friend notifications at any time using the link below.</Text>
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `${d?.friendName ?? 'Your friend'} accepted your friend request`,
  displayName: 'Friend request accepted',
  previewData: { friendName: '@rowanawesome1', friendsUrl: 'https://linguascript.xyz/friends' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { color: PRIMARY, fontWeight: 700, fontSize: '18px', margin: 0 }
const h = { color: INK, fontSize: '24px', fontWeight: 700, margin: '8px 0 16px' }
const p = { color: INK, fontSize: '15px', lineHeight: '24px', margin: '0 0 8px' }
const cta = { backgroundColor: ACCENT, color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: MUTED, fontSize: '12px', lineHeight: '18px', margin: 0 }
