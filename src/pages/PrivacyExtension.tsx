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
      <p className="text-sm text-muted-foreground mb-8">Last updated: 21 October 2026</p>

      <Section title="What the extension does">
        The LinguaScript Chrome extension shows dual-language subtitles on YouTube videos and Netflix shows, lets
        you tap a word to see its translation, colours words by your LinguaScript flashcard
        decks, and saves words you choose to your LinguaScript account.
      </Section>

      <Section title="Permissions we request">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>youtube.com</b> — to show the subtitle overlay on YouTube and read the
            subtitles of the video you are watching.</li>
          <li><b>netflix.com</b> — to show the subtitle overlay on Netflix and read the
            subtitle text on screen while you watch. The extension does nothing on other
            websites.</li>
          <li><b>translate.googleapis.com</b> — to translate a word or subtitle line into your
            language.</li>
          <li><b>Our backend (supabase.co)</b> — to sign you in, read your learning language,
            daily goal, streak and flashcard decks, and save the words you choose.</li>
          <li><b>Identity</b> — only when you choose "Continue with Google": Chrome opens a
            Google sign-in window and passes the sign-in back to the extension.</li>
          <li><b>Storage</b> — to keep you signed in and remember your languages on this
            device.</li>
        </ul>
      </Section>

      <Section title="What data is used">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Account details</b> — your email address and password are sent to our
            backend only to sign you in. The password is never stored by the extension.
            With "Continue with Google", Google confirms who you are and we receive your
            email address; the extension never sees your Google password.</li>
          <li><b>Words you save</b> — the word, its translation and the subtitle line it came
            from are stored in your LinguaScript account so you can review them as
            flashcards.</li>
          <li><b>Text you translate</b> — the word or subtitle line is sent to Google
            Translate to get a translation. No other page content is sent.</li>
        </ul>
        <p>We do not record which videos or shows you watch, your browsing history, your camera or your
          microphone.</p>
      </Section>

      <Section title="Local storage">
        The extension uses your browser's local storage for your sign-in session (an access
        token and refresh token) and your learning and native languages. Logging out from the
        extension's pop-up removes the session; uninstalling the extension removes everything.
      </Section>

      <Section title="Backend authentication">
        Sign-in is handled by the same secure backend as the LinguaScript website. Your
        password is never stored by the extension — only the session tokens, so you stay
        signed in.
      </Section>

      <Section title="Data retention">
        Saved words and review history are kept with your LinguaScript account and follow the
        retention rules described in our <Link to="/privacy" className="underline">website
        privacy policy</Link>.
      </Section>

      <Section title="What we do NOT do">
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not sell or share your data with advertisers.</li>
          <li>We do not track your browsing activity.</li>
          <li>We do not use or transfer your data for purposes unrelated to language learning, or to decide creditworthiness or lending.</li>
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
