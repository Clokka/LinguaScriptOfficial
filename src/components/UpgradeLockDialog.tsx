import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";

interface UpgradeLockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Language of the locked content (e.g. "ja"). */
  contentLanguage?: string | null;
  /** User's currently active learning language (e.g. "fr"). */
  activeLanguage: string;
}

/**
 * Shown when a Free user tries to open content whose language ≠ their active
 * learning language. Pro upgrade is the only path forward (besides switching
 * their active language back, which is rate-limited separately).
 */
export const UpgradeLockDialog = ({
  open,
  onOpenChange,
  contentLanguage,
  activeLanguage,
}: UpgradeLockDialogProps) => {
  const targetLabel = contentLanguage ? getLanguageLabel(contentLanguage) : "this language";
  const targetFlag = contentLanguage ? getLanguageFlag(contentLanguage) : "";
  const activeLabel = getLanguageLabel(activeLanguage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            {targetFlag} {targetLabel} content is Pro
          </DialogTitle>
          <DialogDescription>
            Your active language is <strong>{activeLabel}</strong>. LinguaScript Free is
            designed to help you master one language deeply — switching mid-stream
            slows progress. Upgrade to Pro to unlock <strong>{targetLabel}</strong> and
            study multiple languages in parallel without losing your streak.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Maybe later</Button>
          <Button onClick={() => onOpenChange(false)}>
            <Sparkles className="w-4 h-4 mr-1" /> Upgrade to Pro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
