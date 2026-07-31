/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src="https://linguascript.co.uk/__l5e/assets-v1/d2255c4c-17d7-4181-94b4-54e366a951ae/linguascript-wordmark.png" alt="LinguaScript" width={180} height={54} style={{ display: 'block', margin: '0 auto' }} />
        </Section>
        <Section style={card}>
          <Heading style={h1}>Your login link</Heading>
          <Text style={text}>
            Click below to log in to {siteName}. This link expires shortly for
            your security.
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Log In
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn't request this link, you can safely ignore this email.
          </Text>
        </Section>
        <Img src="https://linguascript.co.uk/__l5e/assets-v1/29bea701-5f96-4bd0-a20a-edc43b4fdaf2/linguascript-mascot-green.png" alt="" width={88} height={40} style={{ display: 'block', margin: '20px auto 0' }} />
        <Text style={signature}>— The LinguaScript team</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: '40px 0',
}
const container = { maxWidth: '560px', margin: '0 auto', padding: '0 20px' }
const header = { textAlign: 'center' as const, padding: '0 0 24px' }
const brand = {
  fontSize: '20px',
  fontWeight: 700 as const,
  letterSpacing: '-0.01em',
  background: '#22c55e',
  WebkitBackgroundClip: 'text' as const,
  WebkitTextFillColor: 'transparent',
  margin: 0,
}
const card = {
  background: '#ffffff',
  border: '1px solid #e6e8eb',
  borderRadius: '16px',
  padding: '32px 28px',
  boxShadow: '0 8px 32px rgba(15, 17, 21, 0.06)',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 700 as const,
  color: '#0f1115',
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const buttonWrap = { textAlign: 'center' as const, margin: '28px 0 12px' }
const button = {
  background: '#22c55e',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { border: 'none', borderTop: '1px solid #e6e8eb', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: '1.5' }
const signature = {
  fontSize: '13px',
  color: '#94A3B8',
  textAlign: 'center' as const,
  margin: '24px 0 0',
}
