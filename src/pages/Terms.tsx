import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

// Links like /terms#refunds (from checkout and the footers) land on the right
// section; an app page doesn't scroll to #anchors on its own.
const useScrollToHash = () => {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
};

const Section = ({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mb-8 scroll-mt-6">
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <div className="text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const Terms = () => {
  useScrollToHash();
  return (
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
      <p className="text-sm text-muted-foreground mb-8">Last updated: 29 October 2026</p>

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

      <Section id="plans" title="4. Plans, limits and payments">
        <p>
          LinguaScript has a free tier and a paid "Pro" tier. What you get is measured in
          <b> new words saved per day</b> and <b>new videos opened per day</b>:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><b>Free:</b> save up to 8 new words a day and watch videos from the LinguaScript
            library. When you reach 8 words, you can keep watching and reviewing your flashcards,
            but saving more new words that day needs Pro. The count starts again the next day.</li>
          <li><b>Pro:</b> no daily limit on saving words, plus one brand-new video a day in each
            language you learn (videos you or others have already opened don't count). When you
            reach the new-video limit, you can still watch everything already available and open
            a new video the next day.</li>
          <li>To keep the Service fair and affordable, some features (such as translations and
            pronunciation audio) also have generous daily fair-use limits. If you reach one, the
            feature works again the next day.</li>
        </ul>
        <p className="mt-2">Paid plans are handled as follows:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><b>On the website</b>, payments are processed by Stripe. We never receive or store
            your card details.</li>
          <li><b>Subscription entitlements</b> are managed through RevenueCat, and in the mobile
            app purchases are made through the Apple App Store or Google Play.</li>
          <li>Recurring plans renew automatically at the end of each billing period until
            cancelled. Prices are shown before you pay, including any applicable tax.</li>
          <li><b>Free trial:</b> a website subscription starts with a 14-day free trial, once per
            account. A card is needed to start it. We email you 3 days before the trial ends; if
            you don't cancel before it ends, the first payment is taken then.</li>
          <li>A <b>lifetime</b> plan (where offered) is a single payment for Pro on your account
            for as long as the Service runs, with no renewals.</li>
          <li>We may also grant Pro access directly (for example through a gift link or a school
            arrangement). Granted access is not a purchase and may be time-limited.</li>
        </ul>
      </Section>

      <Section id="cancellation" title="5. Cancellation">
        <p>
          You can cancel a subscription at any time. Cancelling stops future renewals and takes
          effect at the end of the billing period you have already paid for — you keep Pro until
          then. If you cancel during the free trial, you are not charged and Pro ends when the
          trial ends. Subscriptions bought on the website are cancelled from your Profile page
          (Manage billing) or by emailing us; subscriptions bought in the mobile app must be
          cancelled through your Apple or Google account, because those stores control the
          billing.
        </p>
      </Section>

      <Section id="refunds" title="6. Refunds">
        <p>
          LinguaScript is a digital service. If you are a consumer in the UK or EU, you normally
          have 14 days from purchase to change your mind. Because Pro starts straight away, if you
          cancel within those 14 days we may deduct a fair amount for the time you have already
          used. Where a free trial comes first, the 14 days run from your first payment.
        </p>
        <p>
          We will also refund in full if you were charged by mistake (for example, twice), or if
          Pro did not work and we could not fix it. Outside these cases, payments for periods
          that have already started are not refundable, but you can cancel at any time to stop
          future payments.
        </p>
        <p>
          To ask for a refund on a website purchase, email{" "}
          <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>{" "}
          with the email address on your account. We reply within 5 working days, and approved
          refunds go back to the original card, usually within 5–10 working days. If a lifetime
          purchase is refunded, Pro is removed from the account. Refunds for App Store or Google
          Play purchases are handled by Apple or Google under their policies — we cannot issue
          them. None of this affects your statutory rights.
        </p>
      </Section>

      <Section title="7. Acceptable use">
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

      <Section title="8. Your content">
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

      <Section title="9. Intellectual property">
        <p>
          The LinguaScript name, logo, mascot, interface, original copy and software are ours and
          are protected by intellectual property law. These terms do not give you any right to
          use our branding beyond ordinary use of the Service.
        </p>
      </Section>

      <Section title="10. Third-party content and services">
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

      <Section title="11. Service availability and changes">
        <p>
          We aim to keep LinguaScript available but we do not guarantee uninterrupted service.
          Features may change, and features that depend on third parties (video playback,
          subtitle retrieval, translation) may stop working if those providers change or restrict
          access. We may add, modify or discontinue features; if we discontinue a paid feature
          materially, we will offer a pro-rata refund or a reasonable alternative.
        </p>
      </Section>

      <Section title="12. Suspension and termination">
        <p>
          We may suspend or terminate an account that breaches these terms or that poses a
          security or legal risk, normally with notice where practical. You may stop using the
          Service at any time and may request deletion of your account as described in our{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>. Cancelling a
          subscription does not by itself delete your account or data.
        </p>
      </Section>

      <Section title="13. Disclaimer">
        <p>
          The Service is provided "as is" and "as available". We do not warrant that translations,
          comprehension estimates, difficulty ratings or generated exercises are accurate, nor
          that the Service will meet any particular learning outcome. Nothing here excludes
          liability that cannot be excluded by law, including liability for death or personal
          injury caused by negligence or for fraud.
        </p>
      </Section>

      <Section title="14. Limitation of liability">
        <p>
          To the fullest extent permitted by law, we are not liable for indirect or consequential
          loss, loss of profits, or loss of data arising from your use of the Service. Where we
          are liable, our total liability is limited to the greater of the amount you paid us in
          the twelve months before the claim, or £50. If you are a consumer, this does not affect
          your statutory rights.
        </p>
      </Section>

      <Section title="15. Changes to these terms">
        <p>
          We may update these terms. We will post the updated version here with a new date and,
          for significant changes affecting paid users, notify you by email. Continued use after
          a change means you accept the updated terms.
        </p>
      </Section>

      <Section title="16. Governing law">
        <p>
          These terms are governed by the laws of England and Wales, and disputes will be heard
          in the courts of England and Wales. If you are a consumer in another UK/EU jurisdiction,
          you keep the protection of the mandatory laws of your country of residence.
        </p>
      </Section>

      <Section title="17. Contact">
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
};

export default Terms;
