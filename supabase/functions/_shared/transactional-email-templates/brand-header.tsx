import * as React from 'npm:react@18.3.1'
import { Img, Section } from 'npm:@react-email/components@0.0.22'

const SITE = 'https://linguascript.co.uk'

export const WORDMARK_URL = `${SITE}/__l5e/assets-v1/d2255c4c-17d7-4181-94b4-54e366a951ae/linguascript-wordmark.png`
export const MASCOT_URL = `${SITE}/__l5e/assets-v1/29bea701-5f96-4bd0-a20a-edc43b4fdaf2/linguascript-mascot-green.png`

export const BRAND = {
  green: '#22c55e',
  greenDark: '#16a34a',
  ink: '#0f1115',
  muted: '#64748b',
  border: '#e6e8eb',
  orange: '#fb923c',
  red: '#ef4444',
}

export const BrandHeader = () => (
  <Section style={{ paddingBottom: 20 }}>
    <table cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: 'collapse' }}>
      <tr>
        <td style={{ verticalAlign: 'middle', paddingRight: 10 }}>
          <Img
            src={MASCOT_URL}
            alt=""
            width={52}
            height={24}
            style={{ display: 'block' }}
          />
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <Img
            src={WORDMARK_URL}
            alt="LinguaScript"
            width={168}
            height={50}
            style={{ display: 'block' }}
          />
        </td>
      </tr>
    </table>
  </Section>
)

export const BrandFooterMark = () => (
  <Section style={{ paddingTop: 8, textAlign: 'center' as const }}>
    <Img
      src={MASCOT_URL}
      alt=""
      width={96}
      height={44}
      style={{ display: 'block', margin: '0 auto', opacity: 0.9 }}
    />
  </Section>
)
