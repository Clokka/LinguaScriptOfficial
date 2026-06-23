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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>LinguaScript</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirm your email change</Heading>
          <Text style={text}>
            You requested to change your email for {siteName} from{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>
              {oldEmail}
            </Link>{' '}
            to{' '}
            <Link href={`mailto:${newEmail}`} style={link}>
              {newEmail}
            </Link>
            .
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Confirm Email Change
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn't request this change, please secure your account
            immediately.
          </Text>
        </Section>
        <Text style={signature}>— The LinguaScript team</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
  background: 'linear-gradient(135deg, hsl(252, 100%, 69%), hsl(32, 100%, 55%))',
  WebkitBackgroundClip: 'text' as const,
  WebkitTextFillColor: 'transparent',
  margin: 0,
}
const card = {
  background: '#ffffff',
  border: '1px solid #ECEAF7',
  borderRadius: '16px',
  padding: '32px 28px',
  boxShadow: '0 8px 32px rgba(124, 92, 252, 0.08)',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 700 as const,
  color: '#0F1020',
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const link = { color: 'hsl(252, 100%, 60%)', textDecoration: 'underline' }
const buttonWrap = { textAlign: 'center' as const, margin: '28px 0 12px' }
const button = {
  background: 'linear-gradient(135deg, hsl(252, 100%, 69%), hsl(280, 100%, 60%))',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { border: 'none', borderTop: '1px solid #ECEAF7', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: '1.5' }
const signature = {
  fontSize: '13px',
  color: '#94A3B8',
  textAlign: 'center' as const,
  margin: '24px 0 0',
}
