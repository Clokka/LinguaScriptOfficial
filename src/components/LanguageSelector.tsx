import { useEffect, useState } from "react";
import { Globe, Sparkles, Lock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const SUPPORTED_LANGUAGES = [
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
];

const FREE_SWITCH_ALLOWANCE = 1;

export const LanguageSelector = () => {
  const navigate = useNavigate();
  const { learningLanguage, setLearningLanguage } = useLanguage();
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [switchesUsed, setSwitchesUsed] = useState(0);
  const [pendingLang, setPendingLang] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("is_pro, language_switches_used")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setIsPro(!!(data as any).is_pro);
        setSwitchesUsed((data as any).language_switches_used ?? 0);
      });
  }, [user]);

  const handleSelect = (lang: string) => {
    if (lang === learningLanguage) return;
    // Free users can now switch languages freely — no gating, no confirm.
    setLearningLanguage(lang);
  };

  const confirmSwitch = async () => {
    if (!pendingLang || !user) return;
    setLearningLanguage(pendingLang);
    const next = switchesUsed + 1;
    setSwitchesUsed(next);
    await supabase
      .from("profiles")
      .update({ language_switches_used: next } as any)
      .eq("user_id", user.id);
    setConfirmOpen(false);
    setPendingLang(null);
    toast({
      title: "Active language changed",
      description: "Free plan allows one switch — upgrade to Pro for unlimited languages.",
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground hidden sm:inline">Learning</span>
        <Select value={learningLanguage} onValueChange={handleSelect}>
          <SelectTrigger className="w-[130px] h-8 bg-secondary/50 border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {user && !isPro && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Free · 1 language
          </span>
        )}
      </div>

      {/* Confirm switch (free user, has remaining switches) */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch active language?</DialogTitle>
            <DialogDescription>
              LinguaScript Free lets you focus on one language at a time. You can switch
              once — after that you'll need Pro for unlimited languages. Your saved words
              stay safe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmSwitch}>Use my switch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade prompt (free user, out of switches) */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              Upgrade to learn multiple languages
            </DialogTitle>
            <DialogDescription>
              You've used your free language switch. LinguaScript Pro unlocks unlimited
              active languages — keep your French progress and add Japanese, Spanish or
              German simultaneously.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>Maybe later</Button>
            <Button onClick={() => { setUpgradeOpen(false); navigate("/pricing"); }}>
              <Sparkles className="w-4 h-4 mr-1" /> Upgrade to Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
