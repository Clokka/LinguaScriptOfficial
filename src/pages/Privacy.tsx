import { Link } from "react-router-dom";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <div className="text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const Privacy = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold">LinguaScript</Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/" className="hover:text-foreground">← Home</Link>
        </nav>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: 23 August 2026</p>

      <Section title="1. Who we are">
        <p>
          LinguaScript ("we", "us") is a language-learning web application operated by Rowan
          from the United Kingdom. It helps people learn languages by watching online video with
          dual-language subtitles, saving vocabulary, and reviewing flashcards.
        </p>
        <p>
          Our service is at{" "}
          <a className="underline" href="https://linguascript.co.uk">https://linguascript.co.uk</a>.
          For any privacy question or request, contact{" "}
          <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>.
          For UK GDPR purposes we are the data controller for the data described below.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <p>We collect only what the app needs to work. Specifically:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><b>Account</b> — email address, and a password hash if you sign up with email
            (passwords are handled by our authentication provider and never stored by us in
            plain text).</li>
          <li><b>Profile</b> — display name, username, optional avatar image URL, native
            language, learning language, CEFR level, learning goal, interests, daily word and
            video goals, and email notification preferences.</li>
          <li><b>Vocabulary and flashcards</b> — words and phrases you save, their translations,
            the deck they are in, review results and scheduling data, and the subtitle line the
            word came from.</li>
          <li><b>Learning activity</b> — videos you open, watch position and duration, watch
            sessions, comprehension scores per video, XP events, level, streaks and daily
            activity records.</li>
          <li><b>Generated exercises</b> — the LinguaScript practice exercises created from your
            saved words, and your answers to them.</li>
          <li><b>Social features</b> — friend connections, friend codes, leaderboard visibility
            settings, and messages you send to friends.</li>
          <li><b>Subscription</b> — your plan status, and subscription/customer identifiers from
            our payment providers. We never see or store your card details.</li>
          <li><b>Schools</b> — if you join a school or class, your membership and role in that
            school, so teachers can see class progress.</li>
          <li><b>Email sign-ups</b> — if you submit your email on our landing page before making
            an account, we store that email address so we can contact you about LinguaScript.</li>
        </ul>
        <p>
          We do not collect your camera, microphone recordings, contacts, precise location or
          advertising identifiers. Pronunciation practice uses your browser's built-in speech
          recognition: audio is processed by your browser/operating system and is not sent to or
          stored by us.
        </p>
      </Section>

      <Section title="3. Signing in with Google">
        <p>
          You can create an account or sign in using Google. We request only the standard sign-in
          scopes: <code>openid</code>, <code>email</code> and <code>profile</code>. We request no
          other Google API scopes and have no access to your Gmail, Drive, Calendar, contacts or
          any other Google service.
        </p>
        <p>From Google we receive, and store against your account:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>your Google account identifier — to link your sign-in to your LinguaScript account;</li>
          <li>your email address — to identify your account and send service emails you have
            not opted out of;</li>
          <li>your name and profile picture URL, where Google provides them — used only to show
            your display name and avatar in the app.</li>
        </ul>
        <p>
          Google user data is used solely to authenticate you and to operate your LinguaScript
          account. We do not sell it, we do not use it for advertising or ad profiling, and we do
          not transfer it to third parties except the infrastructure providers listed in section
          5 who process it on our behalf. You can revoke LinguaScript's access at any time in
          your Google Account permissions, and you can request deletion as described in section 8.
        </p>
      </Section>

      <Section title="4. How we use your data">
        <ul className="list-disc pl-5 space-y-1">
          <li>Authenticate you and keep you signed in.</li>
          <li>Show dual-language subtitles and translate words, phrases and subtitle lines you
            ask us to translate.</li>
          <li>Store your vocabulary, colour your subtitles by what you know, and schedule
            flashcard reviews.</li>
          <li>Generate practice exercises from your saved words.</li>
          <li>Track progress: XP, levels, streaks, activity calendar and per-video
            comprehension.</li>
          <li>Recommend videos based on your learning language, level and chosen interests.</li>
          <li>Operate subscriptions and Pro access.</li>
          <li>Send service and learning-reminder emails, and (in the mobile app) notifications
            you have enabled. You can turn off optional emails from your settings or the
            unsubscribe link in any email.</li>
          <li>Diagnose problems, keep the service secure, and improve it.</li>
        </ul>
        <p>
          Our lawful bases under UK GDPR are: performance of a contract (running your account and
          the learning features), legitimate interests (security, service improvement, and
          service-related emails), and consent where required (optional marketing emails and
          push notifications).
        </p>
      </Section>

      <Section title="5. Third-party services">
        <p>We use the following providers. Each processes data only to provide its function:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><b>Supabase</b> — managed Postgres database, authentication and serverless
            functions. This is where your account and learning data lives.</li>
          <li><b>Google Sign-In</b> — optional authentication (see section 3).</li>
          <li><b>YouTube</b> — video playback is embedded from YouTube, and we query the YouTube
            Data API to find and describe videos. When a video plays, YouTube receives your IP
            address and may set its own cookies under Google's privacy policy.</li>
          <li><b>Supadata</b> — used server-side to retrieve subtitle tracks for a video. It
            receives the video identifier, not your identity.</li>
          <li><b>Lovable AI Gateway</b> — used server-side to translate subtitles and words and
            to generate practice exercises. It receives the text to be translated or the words in
            your exercise, not your email or profile.</li>
          <li><b>Stripe</b> — payment processing and web subscriptions. Stripe handles your card
            details directly; we receive only the subscription status and identifiers.</li>
          <li><b>RevenueCat</b> — subscription and entitlement management.</li>
          <li><b>Lovable</b> — application hosting and delivery, and the email infrastructure
            used to send our account and reminder emails.</li>
        </ul>
        <p>
          We do not use advertising networks, and we do not currently run any third-party
          analytics or tracking product on the website.
        </p>
      </Section>

      <Section title="6. Cookies and browser storage">
        <p>
          We do not use advertising or tracking cookies. LinguaScript stores data in your
          browser for the app to function:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Your authentication session, stored by our authentication provider so you stay
            signed in.</li>
          <li>Local preferences such as your active learning language, onboarding progress,
            subtitle settings, your pet, and dismissed prompts.</li>
          <li>If you save words before creating an account, those words are held in your browser
            and merged into your account when you sign in.</li>
        </ul>
        <p>Clearing your browser storage signs you out and removes these local preferences.</p>
      </Section>

      <Section title="7. Data retention">
        <p>
          We keep your account and learning data for as long as your account exists, because the
          service depends on your history (streaks, review scheduling, comprehension over time).
        </p>
        <p>
          Email delivery logs and unsubscribe records are kept so we can respect your
          preferences and avoid re-sending. Payment records held by Stripe are retained by Stripe
          for the period required by law and accounting rules.
        </p>
      </Section>

      <Section title="8. Deleting your account and data">
        <p>
          To delete your account, email{" "}
          <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>{" "}
          from the address on your account. We currently process deletion requests manually; we
          aim to complete them within 30 days and will confirm by email when done.
        </p>
        <p>
          When your account is deleted, the records tied to your user account — profile,
          vocabulary and flashcards, review history, watch history and sessions, comprehension
          records, XP and activity, generated exercises, friendships and messages, subscription
          records and school membership — are deleted with it. Backups may retain copies for a
          short period until they roll over. Where a payment provider is legally required to keep
          a transaction record, that record remains with them.
        </p>
        <p>
          You can also delete individual saved words at any time from the Vocabulary page.
        </p>
      </Section>

      <Section title="9. Your rights (UK/EU GDPR)">
        <p>
          If you are in the UK or EEA you have the right to access, correct, export, delete or
          restrict the processing of your personal data, to object to processing based on
          legitimate interests, and to withdraw consent where processing is based on consent.
        </p>
        <p>
          Email{" "}
          <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>{" "}
          and we will respond within one month. If you are unhappy with our response you can
          complain to the UK Information Commissioner's Office (ico.org.uk) or your local
          supervisory authority.
        </p>
      </Section>

      <Section title="10. Security">
        <p>
          Your data is stored in managed Postgres with row-level security policies, so a signed-in
          user can only read and write their own rows. All traffic to the site and to our backend
          is encrypted with TLS. Authentication, password hashing and session tokens are handled
          by our authentication provider. Server-side keys are held as secrets and are never
          exposed to the browser.
        </p>
        <p>
          No system can be guaranteed completely secure, but we will notify affected users and
          the relevant authority of a personal data breach where the law requires it.
        </p>
      </Section>

      <Section title="11. Children">
        <p>
          LinguaScript is not intended for children under 13. Where LinguaScript is used through
          a school, the school is responsible for obtaining any consent required for its
          students.
        </p>
      </Section>

      <Section title="12. International transfers">
        <p>
          Our providers may process data outside the UK/EEA. Where that happens, transfers are
          made under the safeguards those providers offer, such as standard contractual clauses.
        </p>
      </Section>

      <Section title="13. LinguaScript mobile app">
        <p>
          A LinguaScript mobile app (built with Expo/React Native) is in development. It uses the
          same account, backend and data model as the website, so everything above applies. In
          addition:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><b>Push notifications.</b> If you enable notifications, the app obtains an Expo
            push token (delivered via Apple and Google's push services) and associates it with
            your account so we can send reminders. The token identifies the app installation, not
            you personally, and is removed when you disable notifications or uninstall.</li>
          <li><b>Local reminders.</b> A daily reminder you schedule fires on your device through
            the operating system; the chosen time is stored on your device and mirrored to your
            account.</li>
          <li><b>Device information.</b> We store the platform (iOS/Android) alongside a push
            token so we can debug delivery. We do not collect your advertising identifier.</li>
          <li><b>On-device storage.</b> Your session is stored in the operating system's secure
            storage (iOS Keychain / Android Keystore), and vocabulary may be cached on your
            device so review works offline. The cache is cleared on sign-out.</li>
          <li><b>Third parties in the app.</b> Supabase, Expo (push delivery via Apple APNs and
            Google FCM), Google Sign-In, YouTube, and RevenueCat for in-app purchases.</li>
        </ul>
      </Section>

      <Section title="14. Changes to this policy">
        <p>
          We will post changes on this page with an updated date. For significant changes we will
          notify you by email.
        </p>
      </Section>

      <Section title="15. Contact">
        <p>
          Rowan, LinguaScript —{" "}
          <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>
        </p>
      </Section>

      <p className="text-xs text-muted-foreground mt-10">
        See also our <Link to="/terms" className="underline">Terms of Service</Link> and our{" "}
        <Link to="/privacy-extension" className="underline">Chrome Extension privacy policy</Link>.
      </p>
    </main>
  </div>
);

export default Privacy;
