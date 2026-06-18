import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import { cn } from "@/lib/utils";

/**
 * Persistent chip showing the user's active learning language.
 * Surfaces "Learning 🇪🇸 Spanish" so users can never be confused
 * about which language the platform is currently restricting them to.
 */
export const ActiveLanguageBadge = ({
  className,
  variant = "default",
}: {
  className?: string;
  /** `dark` = white text on dark/video backdrop (Watch). */
  variant?: "default" | "dark";
}) => {
  const { languageContext, isPro } = useLanguage();
  const label = getLanguageLabel(languageContext);
  const flag = getLanguageFlag(languageContext);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        variant === "dark"
          ? "bg-white/10 border-white/20 text-white backdrop-blur"
          : "bg-primary/10 border-primary/25 text-foreground",
        className,
      )}
      title={isPro ? "Pro · all languages unlocked" : "Free plan · one active language"}
    >
      <span className="uppercase tracking-wider text-[10px] opacity-70">Learning</span>
      <span>{flag}</span>
      <span>{label}</span>
      {isPro && <Sparkles className="w-3 h-3 text-amber-400" />}
    </div>
  );
};
