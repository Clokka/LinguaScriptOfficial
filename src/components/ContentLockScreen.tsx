import { Lock, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";

interface ContentLockScreenProps {
  contentLanguage?: string | null;
  activeLanguage: string;
  thumbnailUrl?: string | null;
  title?: string;
  onBack: () => void;
  onUpgrade: () => void;
}

/**
 * Full-screen lock for /watch when a Free user opens a film whose language
 * does not match their active learning language. The film thumbnail is shown
 * blurred behind the lock card so the user still has visual context.
 */
export const ContentLockScreen = ({
  contentLanguage,
  activeLanguage,
  thumbnailUrl,
  title,
  onBack,
  onUpgrade,
}: ContentLockScreenProps) => {
  const targetLabel = contentLanguage ? getLanguageLabel(contentLanguage) : "this language";
  const targetFlag = contentLanguage ? getLanguageFlag(contentLanguage) : "";
  const activeLabel = getLanguageLabel(activeLanguage);

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Blurred thumbnail backdrop */}
      {thumbnailUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-30"
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

      <div className="relative z-10 flex items-center gap-3 p-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {title && <h1 className="text-white/80 font-semibold truncate">{title}</h1>}
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 pb-12">
        <div className="glass-panel-strong max-w-md w-full p-8 rounded-3xl text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {targetFlag} {targetLabel} is locked
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Your active language is <strong className="text-foreground">{activeLabel}</strong>.
            LinguaScript Free keeps you focused on one language at a time so progress
            actually compounds. Upgrade to Pro to study <strong className="text-foreground">{targetLabel}</strong>
            {" "}in parallel — your streak and saved words stay safe.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button variant="ghost" onClick={onBack}>
              Back to browse
            </Button>
            <Button onClick={onUpgrade} className="gap-1">
              <Sparkles className="w-4 h-4" /> Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
