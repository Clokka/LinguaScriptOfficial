import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { resetConsent, getConsent } from "@/lib/consent";

// Adapted from the General Legal Cookie Notice template (CC0 1.0).
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <div className="text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const rows = [
  ["Essential", "Keeps you signed in, remembers your learning language, settings and words saved before sign-up.", "LinguaScript and our sign-in provider", "Always on — the app can't work without it. Clear your browser storage to remove."],
  ["Analytics", "Counts pages visited and features used (PostHog, EU servers) and records anonymised session replays and heatmaps (Microsoft Clarity), so we can fix problems and improve lessons.", "PostHog (posthog.com/privacy), Microsoft (privacy.microsoft.com)", "Off until you tap Accept. Change your choice below at any time."],
  ["Video", "YouTube may set its own cookies when an embedded video plays.", "Google (policies.google.com/privacy)", "Controlled by Google; see your Google account settings."],
  ["Payments", "Stripe uses cookies on its checkout page to prevent fraud.", "Stripe (stripe.com/privacy)", "Only when you open checkout."],
];

const Cookies = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold">LinguaScript</Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </nav>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Cookie Notice</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: 30 October 2026</p>

      <Section title="What are cookies?">
        <p>Cookies and browser storage (such as localStorage) are small pieces of data saved on your device. This notice explains which ones LinguaScript (linguascript.co.uk, our Chrome extension and our mobile app) uses and how you control them.</p>
      </Section>

      <Section title="What we use">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border">
            <thead><tr className="text-left text-foreground">{["Type", "Purpose", "Who", "Your control"].map((h) => <th key={h} className="p-2 border-b border-border">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r[0]} className="align-top">{r.map((c, i) => <td key={i} className="p-2 border-b border-border">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p>We do not use advertising cookies and we do not sell your data.</p>
      </Section>

      <Section title="Your choices">
        <p>Your current analytics choice: <b>{getConsent() === "granted" ? "Accepted" : getConsent() === "denied" ? "Rejected" : "Not chosen yet"}</b>.</p>
        <Button size="sm" variant="outline" onClick={resetConsent}>Change my choice</Button>
        <p>You can also block or delete cookies in your browser settings; blocking essential storage will sign you out.</p>
      </Section>

      <Section title="Changes">
        <p>We will update this notice if we change the technologies we use, and show the new date above.</p>
      </Section>

      <Section title="Questions">
        <p>Email <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>.</p>
      </Section>
    </main>
  </div>
);

export default Cookies;
