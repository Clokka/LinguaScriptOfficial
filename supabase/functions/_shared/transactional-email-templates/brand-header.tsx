import * as React from 'npm:react@18.3.1'
import { Img, Section, Text } from 'npm:@react-email/components@0.0.22'

export const MASCOT_URL =
  'https://linguascript.xyz/__l5e/assets-v1/7659cf11-a14f-48cb-b291-641f309e8a7d/linguascript-mascot.jpg'

const PRIMARY = '#6366f1'

export const BrandHeader = () => (
  <Section style={{ paddingBottom: 16 }}>
    <table cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: 'collapse' }}>
      <tr>
        <td style={{ verticalAlign: 'middle', paddingRight: 12 }}>
          <Img
            src={MASCOT_URL}
            alt="LinguaScript"
            width={40}
            height={40}
            style={{ borderRadius: 10, display: 'block' }}
          />
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <Text style={{ color: PRIMARY, fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em', margin: 0 }}>
            LinguaScript
          </Text>
        </td>
      </tr>
    </table>
  </Section>
)
