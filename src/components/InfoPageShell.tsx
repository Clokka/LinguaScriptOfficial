import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const InfoSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-2xl font-semibold mb-3">{title}</h2>
    <div className="text-muted-foreground space-y-3 leading-relaxed">{children}</div>
  </section>
);

/** Shared header/footer for /explain and /manual; ends with the extension + app funnel. */
export const InfoPageShell = ({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold">LinguaScript</Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/explain" className="hover:text-foreground">How it works</Link>
          <Link to="/manual" className="hover:text-foreground">Manual</Link>
        </nav>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-4xl font-bold mb-3">{title}</h1>
      <p className="text-lg text-muted-foreground mb-10">{intro}</p>
      {children}
      <section className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
        <h2 className="text-2xl font-semibold mb-2">Start learning where you already watch</h2>
        <p className="text-muted-foreground mb-5">Add the Chrome extension for YouTube and any website, or get the Android app.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg"><a href="https://chromewebstore.google.com/search/linguascript" target="_blank" rel="noreferrer">Add to Chrome — free</a></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth">Use the web app</Link></Button>
        </div>
      </section>
    </main>
  </div>
);
