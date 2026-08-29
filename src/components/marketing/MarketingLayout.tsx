import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";

/**
 * Shared shell for the public, indexable marketing and article pages.
 * Keeps one <main>, one H1 and a consistent internal-link footer so every
 * SEO page passes authority to the others.
 */
export function MarketingLayout({
  children,
  eyebrow,
  heading,
  intro,
  cta = { label: "Start learning free", to: "/auth" },
}: {
  children: React.ReactNode;
  eyebrow?: string;
  heading: string;
  intro?: React.ReactNode;
  cta?: { label: string; to: string } | null;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="LinguaScript home">
            <BrandMark size={32} />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/blog" className="hover:text-foreground">
              Blog
            </Link>
            <Link to="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Button size="sm" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        {eyebrow && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mb-5 text-4xl font-extrabold leading-tight md:text-5xl">{heading}</h1>
        {intro && <div className="mb-10 text-lg leading-relaxed text-muted-foreground">{intro}</div>}

        <div className="prose-marketing space-y-6 leading-relaxed text-muted-foreground">
          {children}
        </div>

        {cta && (
          <div className="mt-14 rounded-2xl border border-border/60 bg-secondary/30 p-8 text-center">
            <p className="mb-4 text-lg font-semibold text-foreground">
              Turn everything you watch green.
            </p>
            <Button size="lg" asChild>
              <Link to={cta.to}>{cta.label}</Link>
            </Button>
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto grid max-w-4xl gap-8 px-6 text-sm text-muted-foreground sm:grid-cols-3">
          <div>
            <p className="mb-3 font-semibold text-foreground">Learn</p>
            <ul className="space-y-2">
              <li><Link to="/the-chameleon-method" className="hover:text-foreground">The Chameleon Method</Link></li>
              <li><Link to="/dual-subtitles" className="hover:text-foreground">Dual subtitles</Link></li>
              <li><Link to="/anki-alternative" className="hover:text-foreground">Spaced repetition built in</Link></li>
              <li><Link to="/blog" className="hover:text-foreground">Blog</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold text-foreground">Product</p>
            <ul className="space-y-2">
              <li><Link to="/dual-subtitles/netflix" className="hover:text-foreground">Netflix dual subtitles</Link></li>
              <li><Link to="/dual-subtitles/youtube" className="hover:text-foreground">YouTube dual subtitles</Link></li>
              <li><Link to="/chrome-extension" className="hover:text-foreground">Chrome extension</Link></li>
              <li><Link to="/vs/language-reactor" className="hover:text-foreground">vs Language Reactor</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold text-foreground">More</p>
            <ul className="space-y-2">
              <li><Link to="/for-schools" className="hover:text-foreground">For schools</Link></li>
              <li><Link to="/polyglot" className="hover:text-foreground">Polyglot plan</Link></li>
              <li><Link to="/family" className="hover:text-foreground">Family plan</Link></li>
              <li><Link to="/story" className="hover:text-foreground">Our story</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground">Terms</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-6 text-2xl font-bold text-foreground">{children}</h2>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-lg font-semibold text-foreground">{children}</h3>;
}

export default MarketingLayout;
