import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, GraduationCap, Lock, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/premium";
import netflix from "@/assets/platforms/netflix.svg.asset.json";
import youtube from "@/assets/platforms/youtube.svg.asset.json";
import crunchyroll from "@/assets/platforms/crunchyroll.svg.asset.json";
import tv5monde from "@/assets/platforms/tv5monde.svg.asset.json";
import openai from "@/assets/platforms/openai.svg.asset.json";
import claude from "@/assets/platforms/claude.svg.asset.json";
import launch from "@/assets/videos/linguascript-launch.mp4.asset.json";
import platforms from "@/assets/videos/linguascript-launch-platforms-progress.mp4.asset.json";
import schools from "@/assets/videos/linguascript-schools-explainer.mp4.asset.json";

export const STREAMING_PLATFORMS = [
  { name: "YouTube", url: "https://www.youtube.com/", logo: youtube, kind: "youtube" },
  { name: "Netflix", url: "https://www.netflix.com/browse", logo: netflix, kind: "netflix" },
  { name: "Crunchyroll", url: "https://www.crunchyroll.com/", logo: crunchyroll, kind: "crunchyroll" },
  { name: "TV5MONDE", url: "https://www.tv5mondeplus.com/", logo: tv5monde, kind: "tv5monde" },
] as const;

export function PlatformLinks() {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {STREAMING_PLATFORMS.map(p => <Button key={p.name} variant="outline" asChild className="ls-platform h-16 justify-between gap-2 px-4">
      <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.name}`}>
        <span className="flex min-w-0 items-center gap-2"><img className={`ls-platform-logo ls-logo-${p.kind}`} src={p.logo.url} alt="" width="24" height="24" /><span className="text-xs sm:text-sm">{p.name}</span></span><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </a>
    </Button>)}
  </div>;
}

export function AIConnectionCards({ isPro = false }: { isPro?: boolean }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    {[{ name: "ChatGPT", logo: openai, kind: "chatgpt" }, { name: "Claude", logo: claude, kind: "claude" }].map(a => <GlassCard key={a.name} accent="gold" className="p-5">
      <div className="flex items-center justify-between gap-3"><img src={a.logo.url} alt={a.name} className={`ls-ai-logo ls-logo-${a.kind}`} width="32" height="32" /><span className="flex items-center gap-1 text-xs font-semibold text-warning"><Lock className="h-3 w-3" /> LinguaScript Pro</span></div>
      <h3 className="mt-4 text-xl font-bold">{a.name}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Practise your saved words, review vocabulary and learn through your interests.</p>
      <Button asChild variant="outline" className="mt-5 w-full"><Link to={isPro ? `/ai?app=${a.kind}` : "/pricing"}>{isPro ? `Connect ${a.name}` : "Explore Pro"}<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
    </GlassCard>)}
  </div>;
}

export function VideoShowcase({ schoolOnly = false }: { schoolOnly?: boolean }) {
  const films = schoolOnly ? [{ title: "For schools & teachers", asset: schools }] : [{ title: "The product", asset: launch }, { title: "Watching & progress", asset: platforms }, { title: "For schools & teachers", asset: schools }];
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const film = films[selected] ?? films[0];
  return <div>
    {!schoolOnly && <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Product films">{films.map((f, i) => <Button key={f.title} role="tab" aria-selected={selected === i} variant={selected === i ? "secondary" : "ghost"} size="sm" onClick={() => { setSelected(i); setPlaying(false); }}>{f.title}</Button>)}</div>}
    <div className="ls-film-stage">
      {playing ? <video key={film.asset.url} src={film.asset.url} controls autoPlay playsInline preload="none" className="h-full w-full" aria-label={film.title} /> : <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
        <img src="/logo.svg" alt="LinguaScript chameleon" width="80" height="80" className="ls-mascot-float" />
        <p className="text-2xl font-bold sm:text-3xl">{schoolOnly ? "Film. Vocabulary. Confidence." : "Watch what you love."}</p>
        <Button onClick={() => setPlaying(true)} size="lg"><Play className="mr-2 h-4 w-4" />Watch {film.title.toLowerCase()}</Button>
      </div>}
    </div>
  </div>;
}

export function LearningSteps() {
  return <div className="grid gap-6 sm:grid-cols-3">{[
    { icon: Play, title: "Watch", text: "Follow films with two subtitle languages. Save new words from the scene." },
    { icon: Volume2, title: "Practise", text: "Listen to words and phrases. Say them aloud and practise your pronunciation." },
    { icon: BookOpen, title: "Remember", text: "Review your own flashcards. Your words move through red, orange, green and gold." },
  ].map(({ icon: Icon, title, text }, i) => <div key={title} className="border-t border-border pt-5"><div className="flex items-center gap-3 text-primary"><Icon className="h-5 w-5" /><span className="text-xs text-muted-foreground">0{i + 1}</span></div><h3 className="mt-4 text-2xl font-bold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p></div>)}</div>;
}

export function SchoolSection() {
  return <section className="ls-section border-t border-border">
    <div className="mb-8 flex items-center gap-2 text-sm text-warning"><GraduationCap className="h-5 w-5" /> For schools & teachers</div>
    <div className="grid items-start gap-10 lg:grid-cols-2"><div><h2 className="text-3xl font-bold leading-tight sm:text-4xl">Bring real language<br />into the classroom.</h2><p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">Help students build vocabulary and practise pronunciation through films. Keep track of class activity and the words each student learns.</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link to="/for-schools">LinguaScript for schools<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline"><Link to="/teacher">Teacher dashboard</Link></Button></div></div><VideoShowcase schoolOnly /></div>
  </section>;
}