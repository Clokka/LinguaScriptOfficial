import { Link } from "react-router-dom";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <div className="text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const PrivacyExtension = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold">LinguaScript</Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Chrome Extension Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: 21 June 2026</p>

      <Section title="What the extension does">
        The LinguaScript Chrome extension overlays dual-language subtitles on Netflix and
        YouTube, lets you click words for translations, and saves vocabulary to your
        LinguaScript account.
      </Section>

      <Section title="Permissions we request">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Host permissions on netflix.com and youtube.com</b> — to run the content
            script that renders the subtitle overlay and reads subtitle text from the video
            you are watching. Declared statically in the extension manifest, not injected
            dynamically.</li>
          <li><b>activeTab / tabs</b> — to detect whether your current tab is a supported
            Netflix or YouTube watch page, so the extension's popup shows the right screen.</li>
          <li><b>Storage</b> — to keep your sign-in token, language preference, and a small
            on-device cache of captured subtitle lines awaiting sync.</li>
        </ul>
      </Section>

      <Section title="Subtitle processing">
        Subtitles are read from the page you are watching. When you click a word, its text is
        sent to a translation service (Google Translate or MyMemory) to fetch a translation —
        no other page content is sent anywhere. Saved words and your account data are stored
        with our backend (Supabase). We do not record the videos you watch, your camera, your
        microphone, or your general browsing history.
      </Section>

      <Section title="Local storage">
        The extension uses your browser's local storage for: your authentication token, your
        active learning and native languages, and a short-lived on-device cache of subtitle
        lines captured from the page, cleared once they're synced to your account. You can
        clear this at any time from the extension's settings.
      </Section>

      <Section title="Backend authentication">
        Sign-in is handled by the same secure backend as the LinguaScript website. Your
        credentials are never stored by the extension itself — only a refresh token is held in
        local storage so you stay signed in.
      </Section>

      <Section title="Data retention">
        Saved words and review history are kept with your LinguaScript account and follow the
        retention rules described in our <Link to="/privacy" className="underline">website
        privacy policy</Link>.
      </Section>

      <Section title="What we do NOT do">
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not sell or share your data with advertisers.</li>
          <li>We do not track browsing activity outside of the video subtitles you interact with.</li>
          <li>We do not collect personally identifiable information beyond your account email.</li>
        </ul>
      </Section>

      <Section title="GDPR rights">
        You can access, export, or delete your data at any time by emailing us. See the website
        privacy policy for full details.
      </Section>

      <Section title="Contact">
        Rowan — <a className="underline" href="mailto:rowan@linguascript.co.uk">rowan@linguascript.co.uk</a>
      </Section>
    </main>
  </div>
);

export default PrivacyExtension;
