import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageLabel } from "@/lib/languages";
import { PlatformLinks } from "./BrandExperience";

export default function StreamingHubHeader() {
  const { learningLanguage } = useLanguage();
  return <section className="ls-hub-hero">
    <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-warning"><img src="/logo.svg" alt="" width="24" height="24" /> YOUR LINGUASCRIPT</div>
    <h1 className="ls-hub-title">What do you want<br />to watch in <span className="text-primary">{getLanguageLabel(learningLanguage || "fr")}?</span></h1>
    <div className="mt-7"><PlatformLinks /></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>External streaming sites · subscriptions may be required</span><a className="text-primary underline underline-offset-4" href="/chrome-extension">Get the Chrome extension</a></div>
  </section>;
}