import { useCallback, useEffect, useState } from "react";
import { Check, Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { LANGUAGES, getLanguageFlag, getLanguageLabel } from "@/lib/languages";
import {
  CEFR_LEVELS,
  MAX_LANGUAGES,
  MODE_META,
  addLanguageProfile,
  listLanguageProfiles,
  removeLanguageProfile,
  updateLanguageProfile,
  type LanguageProfile,
  type LearningMode,
} from "@/lib/languageProfiles";
import { cn } from "@/lib/utils";

/**
 * "My languages" — up to 5 independent learning profiles. Each language keeps
 * its own mode, level, vocabulary and comprehension, so switching resets the
 * whole experience to that language.
 */
export const MyLanguagesPanel = ({ nativeLanguage }: { nativeLanguage?: string }) => {
  const { user } = useAuth();
  const { languageContext, setLearningLanguage } = useLanguage();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<LanguageProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newLang, setNewLang] = useState("");
  const [newMode, setNewMode] = useState<LearningMode>("fluency");
  const [newLevel, setNewLevel] = useState<string>("a1");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setProfiles(await listLanguageProfiles(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const usedCodes = new Set(profiles.map((p) => p.language));
  const available = LANGUAGES.filter(
    (l) => !usedCodes.has(l.code) && l.code !== nativeLanguage,
  );

  const handleAdd = async () => {
    if (!user || !newLang) return;
    setSaving(true);
    const { error } = await addLanguageProfile({
      userId: user.id,
      language: newLang,
      mode: newMode,
      level: newLevel,
    });
    setSaving(false);
    if (error) {
      toast({
        title: "Couldn't add language",
        description:
          error === "language_limit_reached"
            ? `You can learn up to ${MAX_LANGUAGES} languages at once.`
            : error,
        variant: "destructive",
      });
      return;
    }
    setAddOpen(false);
    setNewLang("");
    await load();
    toast({
      title: `${getLanguageLabel(newLang)} added`,
      description: "Your known words for this level have been marked green.",
    });
  };

  const handleRemove = async (language: string) => {
    if (!user) return;
    await removeLanguageProfile(user.id, language);
    await load();
    toast({ title: `${getLanguageLabel(language)} removed`, description: "Your saved words are kept." });
  };

  const handleMode = async (language: string, mode: LearningMode) => {
    if (!user) return;
    setProfiles((prev) => prev.map((p) => (p.language === language ? { ...p, mode } : p)));
    await updateLanguageProfile(user.id, language, { mode });
  };

  return (
    <div className="pt-4 border-t border-border/50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> My languages
        </p>
        <span className="text-xs text-muted-foreground">
          {profiles.length}/{MAX_LANGUAGES}
        </span>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => {
            const active = p.language === languageContext;
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  active ? "border-primary/50 bg-primary/5" : "border-border/50 bg-secondary/30",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getLanguageFlag(p.language)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {getLanguageLabel(p.language)}
                      {active && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {MODE_META[p.mode]?.emoji} {MODE_META[p.mode]?.label} ·{" "}
                      {p.cefr_level.toUpperCase()}
                    </p>
                  </div>
                  {!active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLearningLanguage(p.language)}
                    >
                      Switch
                    </Button>
                  )}
                  {active && <Check className="w-4 h-4 text-primary" />}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(p.language)}
                    aria-label={`Remove ${getLanguageLabel(p.language)}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-2 flex gap-2">
                  {(Object.keys(MODE_META) as LearningMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMode(p.language, m)}
                      className={cn(
                        "flex-1 text-[11px] rounded-lg border px-2 py-1.5 transition-colors",
                        p.mode === m
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border/50 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {MODE_META[m].emoji} {MODE_META[m].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {profiles.length < MAX_LANGUAGES && (
            <Button
              variant="ghost"
              className="w-full gap-2 border border-dashed border-border/60"
              onClick={() => {
                setNewLang(available[0]?.code ?? "");
                setAddOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Add a language
            </Button>
          )}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a language</DialogTitle>
            <DialogDescription>
              Each language keeps its own vocabulary, comprehension score and progress.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Language</label>
              <Select value={newLang} onValueChange={setNewLang}>
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Choose a language" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.flag} {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">How do you want to learn?</label>
              <div className="grid gap-2">
                {(Object.keys(MODE_META) as LearningMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setNewMode(m)}
                    className={cn(
                      "text-left rounded-xl border p-3 transition-colors",
                      newMode === m
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/50 bg-secondary/30 hover:border-border",
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {MODE_META[m].emoji} {MODE_META[m].label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{MODE_META[m].blurb}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Your current level
              </label>
              <Select value={newLevel} onValueChange={setNewLevel}>
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CEFR_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!newLang || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Add language
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
