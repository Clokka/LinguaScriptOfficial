import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { ExperienceNav, SCHOOL_EXPERIENCES } from "@/components/premium/ExperienceNav";
import { DashboardPreview, PronunciationPreview, VocabularyPreview, WatchPlatformsPreview } from "@/components/premium/SchoolPreview";
import { SchoolHeader } from "./Schools";
const TEXT: Record<string, [string, string]> = {
  watch: ["Every scene becomes a lesson.", "French and English subtitles, together. Explore a word from the scene, then follow it into vocabulary practice."],
  pronunciation: ["Hear it. Say it.", "Listen to a French phrase, then practise aloud. The same listen-and-speak experience is available alongside phrases in the player."],
  vocabulary: ["From a new word to a familiar one.", "Words keep their context. Short flashcard reviews help students retrieve their meaning instead of only recognising it."],
  progress: ["Watch your language learning grow.", "Keep vocabulary, viewing and review activity together. These sample figures demonstrate the layout, not promised learning results."],
  teachers: ["See how your class is learning.", "Follow class activity and vocabulary, invite students, and export progress from your own teacher dashboard."],
};
export default function SchoolTour() {
  const { experience = "watch" } = useParams();
  const key = TEXT[experience] ? experience : "watch";
  const [title, description] = TEXT[key];
  const index = SCHOOL_EXPERIENCES.findIndex(x => x.slug === key);
  const next = SCHOOL_EXPERIENCES[(index + 1) % SCHOOL_EXPERIENCES.length];
  return <div className="min-h-screen ls-cinema text-foreground"><Seo title={`${title} — LinguaScript school tour`} description={description} path={`/schools/tour/${key}`} /><SchoolHeader /><main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ExperienceNav tour /><div className="py-10"><p className="text-xs font-semibold text-warning">SCHOOL PRODUCT TOUR · {index + 1}/5</p><h1 className="mt-4 text-3xl font-bold sm:text-5xl">{title}</h1><p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">{description}</p></div><section className="ls-tour-stage">{key === "watch" ? <WatchPlatformsPreview /> : key === "pronunciation" ? <PronunciationPreview /> : key === "vocabulary" ? <VocabularyPreview /> : <DashboardPreview teacher={key === "teachers"} />}</section><div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border py-8"><Button asChild variant="outline"><Link to={`/schools/tour/${next.slug}`}>Next: {next.label}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild><Link to="/for-schools#enquire">Request a school walkthrough</Link></Button></div></main></div>;
}