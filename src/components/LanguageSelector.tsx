import { useCallback, useEffect, useState } from "react";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { LANGUAGES, getLanguageFlag, getLanguageLabel } from "@/lib/languages";
import { listLanguageProfiles } from "@/lib/languageProfiles";

/**
 * Switches the active learning language. Every language the learner has added
 * (up to 5) is listed — all free, no gating. Languages are added and removed
 * from Profile → My languages.
 */
export const LanguageSelector = () => {
  const { learningLanguage, setLearningLanguage } = useLanguage();
  const { user } = useAuth();
  const [codes, setCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setCodes([]);
      return;
    }
    const profiles = await listLanguageProfiles(user.id);
    setCodes(profiles.map((p) => p.language));
  }, [user]);

  useEffect(() => {
    load();
  }, [load, learningLanguage]);

  const options = (codes.length ? codes : [learningLanguage]).filter(Boolean);

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs uppercase tracking-wider text-muted-foreground hidden sm:inline">
        Learning
      </span>
      <Select
        value={learningLanguage}
        onValueChange={(lang) => {
          if (lang !== learningLanguage) setLearningLanguage(lang);
        }}
      >
        <SelectTrigger className="w-[130px] h-8 bg-secondary/50 border-border text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((code) => (
            <SelectItem key={code} value={code}>
              <span className="flex items-center gap-2">
                <span>{getLanguageFlag(code)}</span>
                <span>{getLanguageLabel(code)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/** Full supported list, kept for callers that need every option. */
export const ALL_LANGUAGES = LANGUAGES;
