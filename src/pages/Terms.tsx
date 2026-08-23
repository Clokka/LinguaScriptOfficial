import { Link } from "react-router-dom";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <div className="text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const Terms = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold">LinguaScript</Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: 23 August 2026</p>

      <Section title="1. Acceptance of terms">
        By accessing or using LinguaScript ("the Service"), you agree to be bound by these Terms of Service.
        If you do not agree, please do not use the Service.
      </Section>

      <Section title="2. Description of service">
        LinguaScript is a language-learning platform that lets users watch videos with dual-language
        subtitles, save vocabulary, review flashcards, and complete interactive exercises.
      </Section>

      <Section title="3. Accounts and eligibility">
        You must provide accurate information when creating an account. You are responsible for keeping
        your login credentials secure and for all activity under your account. You must be at least 13
        years old to use the Service, or older if required by your local law.
      </Section>

      <Section title="4. Subscriptions and payments">
        Some features require a paid subscription. Payments are processed through our third-party
        providers. Subscriptions renew automatically unless cancelled before the renewal date. Refunds
        are handled in accordance with applicable law and the policies of our payment processors.
      </Section>

      <Section title="5. Acceptable use">
        You agree not to:
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Scrape, copy, or redistribute content from the Service without permission.</li>
          <li>Attempt to bypass access controls or interfere with the Service's infrastructure.</li>
          <li>Use the Service for unlawful, abusive, or fraudulent purposes.</li>
          <li>Upload harmful files, malware, or infringing material.</li>
        </ul>
      </Section>

      <Section title="6. Content and intellectual property">
        LinguaScript and its original content, features, and branding are owned by us and protected
        by intellectual property laws. User-generated content (such as saved vocabulary and progress)
        remains yours, and you grant us a licence to host and process it so we can provide the Service.
      </Section>

      <Section title="7. Third-party services">
        The Service integrates with third parties such as YouTube, Google Sign-In, Stripe, and RevenueCat.
        Your use of those services is subject to their respective terms and policies.
      </Section>

      <Section title="8. Termination">
        We may suspend or terminate your account if you violate these terms. You may delete your account
        at any time from your profile settings.
      </Section>

      <Section title="9. Disclaimer and limitation of liability">
        The Service is provided "as is" without warranties of any kind. To the fullest extent permitted
        by law, we are not liable for indirect, incidental, or consequential damages arising from your
        use of the Service.
      </Section>

      <Section title="10. Changes to these terms">
        We may update these terms from time to time. We will notify you of significant changes by posting
        the updated terms on this page with a revised date.
      </Section>

      <Section title="11. Governing law">
        These terms are governed by the laws of England and Wales. Any disputes will be resolved in the
        courts of England and Wales.
      </Section>

      <Section title="12. Contact">
        If you have any questions about these terms, please contact us at{" "}
        <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>.
      </Section>

      <p className="text-xs text-muted-foreground mt-10">
        See also our <Link to="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </main>
  </div>
);

export default Terms;
