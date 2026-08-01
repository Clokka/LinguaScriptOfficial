/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src="https://linguascript.co.uk/__l5e/assets-v1/d2255c4c-17d7-4181-94b4-54e366a951ae/linguascript-wordmark.png" alt="LinguaScript" width={180} height={54} style={{ display: 'block', margin: '0 auto' }} />
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirm reauthentication</Heading>
          <Text style={text}>Use the code below to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Hr style={hr} />
          <Text style={footer}>
            This code expires shortly. If you didn't request it, you can safely
            ignore this email.
          </Text>
        </Section>
        <Img src="https://linguascript.co.uk/__l5e/assets-v1/29bea701-5f96-4bd0-a20a-edc43b4fdaf2/linguascript-mascot-green.png" alt="" width={88} height={40} style={{ display: 'block', margin: '20px auto 0' }} />
        <Text style={signature}>— The LinguaScript team</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '28px',
  fontWeight: 700 as const,
  letterSpacing: '0.3em',
  color: '#0f1115',
  textAlign: 'center' as const,
  background: '#ecfdf5',
  borderRadius: '12px',
  padding: '16px 0',
  margin: '8px 0 16px',
}
const hr = { border: 'none', borderTop: '1px solid #e6e8eb', margin: '16px 0' }
const footer = { fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: '1.5' }
const signature = {
  fontSize: '13px',
  color: '#94A3B8',
  textAlign: 'center' as const,
  margin: '24px 0 0',
}
