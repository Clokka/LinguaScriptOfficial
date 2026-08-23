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
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/" className="hover:text-foreground">← Home</Link>
        </nav>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: 23 August 2026</p>

      <Section title="1. Acceptance of terms">
        <p>
          These terms are an agreement between you and LinguaScript, operated by Rowan in the
          United Kingdom ("we", "us"), covering{" "}
          <a className="underline" href="https://linguascript.co.uk">linguascript.co.uk</a>, the
          LinguaScript mobile app and the LinguaScript browser extension (together, "the
          Service"). By using the Service you agree to these terms. If you do not agree, please
          do not use the Service.
        </p>
      </Section>

      <Section title="2. Description of the service">
        <p>
          LinguaScript is a language-learning tool. It plays third-party video (currently
          embedded from YouTube) with dual-language subtitles, lets you click words for
          translations, save vocabulary and phrases, review flashcards, complete generated
          practice exercises, and track progress such as XP, streaks and estimated comprehension.
        </p>
        <p>
          Translations, subtitle text and generated exercises are produced automatically,
          including by AI systems. They can be inaccurate or incomplete and are provided as a
          learning aid, not as a professional translation service.
        </p>
      </Section>

      <Section title="3. Accounts and eligibility">
        <p>
          You need an account for most features. You may sign up with an email and password or
          with Google. Provide accurate information, keep your credentials secure, and tell us if
          you believe your account has been used without permission. You are responsible for
          activity under your account.
        </p>
        <p>
          You must be at least 13 years old, or older where your local law requires. If
          LinguaScript is provided to you through a school, your school administers your access
          and staff at that school may see your learning progress.
        </p>
      </Section>

      <Section title="4. Subscriptions and payments">
        <p>
          LinguaScript has a free tier and a paid "Pro" tier. Paid plans are handled as follows:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><b>On the website</b>, payments are processed by Stripe. We never receive or store
            your card details.</li>
          <li><b>Subscription entitlements</b> are managed through RevenueCat, and in the mobile
            app purchases are made through the Apple App Store or Google Play.</li>
          <li>Recurring plans renew automatically at the end of each billing period until
            cancelled. Prices are shown before you pay, including any applicable tax.</li>
          <li>We may also grant Pro access directly (for example through a gift link or a school
            arrangement). Granted access is not a purchase and may be time-limited.</li>
        </ul>
      </Section>

      <Section title="5. Cancellation and refunds">
        <p>
          You can cancel a subscription at any time. Cancelling stops future renewals; you keep
          Pro access until the end of the period you have already paid for. Subscriptions bought
          on the website are cancelled through the billing portal linked from your account or by
          emailing us; subscriptions bought in the mobile app must be cancelled through your
          Apple or Google account, because those stores control the billing.
        </p>
        <p>
          Refunds for App Store or Google Play purchases are handled by Apple or Google under
          their policies — we cannot issue them. For purchases made on the website, contact us
          and we will handle the request in line with your statutory rights, including UK/EU
          consumer cancellation rights where they apply.
        </p>
      </Section>

      <Section title="6. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Scrape, bulk-download or redistribute content or data from the Service.</li>
          <li>Attempt to bypass access controls, plan limits, rate limits or authentication.</li>
          <li>Interfere with, overload or probe the Service's infrastructure.</li>
          <li>Use the Service for unlawful, abusive, harassing or fraudulent purposes, including
            in messages to other users.</li>
          <li>Upload malware or material that infringes someone else's rights.</li>
          <li>Resell or provide the Service to others except under a school or licence
            arrangement agreed with us.</li>
        </ul>
      </Section>

      <Section title="7. Your content">
        <p>
          The material you create in LinguaScript is mostly learning data: saved words and
          phrases, decks, exercise answers, progress, plus profile details such as your display
          name and avatar, and messages you send to friends. You keep ownership of it, and you
          grant us a limited licence to store, process and display it back to you so we can run
          the Service.
        </p>
        <p>
          You are responsible for what you submit — in particular display names, usernames and
          friend messages must not be offensive, misleading or infringing. We may remove content
          that breaches these terms.
        </p>
      </Section>

      <Section title="8. Intellectual property">
        <p>
          The LinguaScript name, logo, mascot, interface, original copy and software are ours and
          are protected by intellectual property law. These terms do not give you any right to
          use our branding beyond ordinary use of the Service.
        </p>
      </Section>

      <Section title="9. Third-party content and services">
        <p>
          LinguaScript does not host, own or license the videos you watch. Video is embedded from
          YouTube and remains the property of its rights holders; your use of it is subject to
          YouTube's terms of service and Google's privacy policy. Subtitles may come from the
          video platform, from a subtitle provider, or from automatic translation, and we make no
          claim of ownership over third-party subtitle text.
        </p>
        <p>
          The Service also relies on Supabase, Google Sign-In, Stripe, RevenueCat, Expo and AI
          translation providers. Your use of those services is subject to their own terms. We are
          not responsible for third-party services or for changes they make.
        </p>
      </Section>

      <Section title="10. Service availability and changes">
        <p>
          We aim to keep LinguaScript available but we do not guarantee uninterrupted service.
          Features may change, and features that depend on third parties (video playback,
          subtitle retrieval, translation) may stop working if those providers change or restrict
          access. We may add, modify or discontinue features; if we discontinue a paid feature
          materially, we will offer a pro-rata refund or a reasonable alternative.
        </p>
      </Section>

      <Section title="11. Suspension and termination">
        <p>
          We may suspend or terminate an account that breaches these terms or that poses a
          security or legal risk, normally with notice where practical. You may stop using the
          Service at any time and may request deletion of your account as described in our{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>. Cancelling a
          subscription does not by itself delete your account or data.
        </p>
      </Section>

      <Section title="12. Disclaimer">
        <p>
          The Service is provided "as is" and "as available". We do not warrant that translations,
          comprehension estimates, difficulty ratings or generated exercises are accurate, nor
          that the Service will meet any particular learning outcome. Nothing here excludes
          liability that cannot be excluded by law, including liability for death or personal
          injury caused by negligence or for fraud.
        </p>
      </Section>

      <Section title="13. Limitation of liability">
        <p>
          To the fullest extent permitted by law, we are not liable for indirect or consequential
          loss, loss of profits, or loss of data arising from your use of the Service. Where we
          are liable, our total liability is limited to the greater of the amount you paid us in
          the twelve months before the claim, or £50. If you are a consumer, this does not affect
          your statutory rights.
        </p>
      </Section>

      <Section title="14. Changes to these terms">
        <p>
          We may update these terms. We will post the updated version here with a new date and,
          for significant changes affecting paid users, notify you by email. Continued use after
          a change means you accept the updated terms.
        </p>
      </Section>

      <Section title="15. Governing law">
        <p>
          These terms are governed by the laws of England and Wales, and disputes will be heard
          in the courts of England and Wales. If you are a consumer in another UK/EU jurisdiction,
          you keep the protection of the mandatory laws of your country of residence.
        </p>
      </Section>

      <Section title="16. Contact">
        <p>
          Rowan, LinguaScript —{" "}
          <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>
        </p>
      </Section>

      <p className="text-xs text-muted-foreground mt-10">
        See also our <Link to="/privacy" className="underline">Privacy Policy</Link> and our{" "}
        <Link to="/privacy-extension" className="underline">Chrome Extension privacy policy</Link>.
      </p>
    </main>
  </div>
);

export default Terms;
