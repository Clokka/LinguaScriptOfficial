import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Play, UserRound } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AIConnectionCards, LearningSteps, PlatformLinks, SchoolSection, VideoShowcase } from "@/components/premium/BrandExperience";

export default function Landing5() {
  const { user } = useAuth();
  const { isPro } = useLanguage();
  return <div className="ls-product-page min-h-screen bg-background text-foreground">
    <Seo title="LinguaScript — Language learning through film" description="Watch films, learn new vocabulary and practise pronunciation. LinguaScript brings language learning to students, schools and teachers." path="/" rawTitle />
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4"><Link to="/" aria-label="LinguaScript home"><BrandMark variant="lockup" size={32} /></Link>
        <nav className="flex items-center gap-2"><Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/for-schools">For schools</Link></Button><Button asChild variant="ghost" size="sm"><Link to={user ? "/profile" : "/auth"}><UserRound className="mr-2 h-4 w-4" />{user ? "Profile" : "Sign in"}</Link></Button><Button asChild size="sm"><Link to={user ? "/browse" : "/onboarding"}>{user ? "Watch" : "Start free"}</Link></Button></nav>
      </div>
    </header>
    <main>
      <section className="ls-cinema border-b border-border">
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pt-16">
          <div className="mb-5 flex items-center gap-2 text-sm text-warning"><GraduationCap className="h-4 w-4" />For learners, schools & teachers</div>
          <h1 className="text-5xl font-bold leading-[1.08] sm:text-7xl">LinguaScript</h1>
          <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">Watch what you love.<br /><span className="text-primary">Make the language yours.</span></h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">Films become vocabulary practice. Listen to real language, save new words and practise pronunciation — with progress you and your teacher can see.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button size="lg" asChild><Link to={user ? "/browse" : "/onboarding"}><Play className="mr-2 h-4 w-4" />Start watching</Link></Button><Button size="lg" variant="outline" asChild><Link to="/chrome-extension">Get the Chrome extension<ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button size="lg" variant="ghost" asChild><Link to="/explain">How it works</Link></Button></div>
          <div className="ls-caption-glass mt-10"><div className="ls-marquee" aria-hidden="true" translate="no"><div className="ls-marquee-line">{[...Array(4)].flatMap((_, i) => ["bonjour", "cinéma", "voyage", "demain", "ensemble", "apprendre"].map(w => <span key={`${i}-${w}`}>{w}</span>))}</div></div></div>
          <div className="mt-8"><PlatformLinks /></div><p className="mt-3 text-xs text-muted-foreground">Learn on external sites with the Chrome extension. Subtitle support varies by title and player; platform subscriptions are separate.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="ls-section"><div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 text-xs font-semibold text-warning">THE CHAMELEON METHOD</p><h2 className="text-3xl font-bold sm:text-4xl">A scene. A word. A little progress.</h2></div><Button variant="ghost" asChild><Link to="/manual">Read the manual<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div><LearningSteps /></section>
        <section className="ls-section border-t border-border"><h2 className="mb-7 text-3xl font-bold">See LinguaScript in motion.</h2><VideoShowcase /></section>
        <SchoolSection />
        <section className="ls-section border-t border-border"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 text-xs font-semibold text-warning">LINGUASCRIPT PRO</p><h2 className="text-3xl font-bold">Your vocabulary, inside your AI.</h2><p className="mt-4 max-w-xl text-muted-foreground">MCP connects your own saved words and learning progress to ChatGPT or Claude. Sign in, grant access and practise with the vocabulary you actually need.</p></div><Button asChild variant="outline"><Link to="/ai">Connection guide<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div><AIConnectionCards isPro={isPro} /><p className="mt-4 text-xs text-muted-foreground">Requires LinguaScript Pro and an eligible account with your chosen AI service. User-configured connections; no official partnership.</p></section>
      </div>
    </main>
    <footer className="border-t border-border py-8"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 text-sm text-muted-foreground"><BrandMark size={28} /><div className="flex flex-wrap gap-5">{[["/for-schools","Schools"],["/pricing","Pricing"],["/explain","Product"],["/privacy","Privacy"],["/terms","Terms"]].map(([to,label])=><Link key={to} to={to}>{label}</Link>)}</div><span>© {new Date().getFullYear()} LinguaScript</span></div></footer>
  </div>;
}
