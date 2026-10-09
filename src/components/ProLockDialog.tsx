import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ProLockCard } from "@/components/ProLockCard";

/** ProLockCard in a dialog, for a free learner tapping a Pro-only door. */
export function ProLockDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs rounded-3xl border-border bg-background p-8">
        <DialogTitle className="sr-only">Pro</DialogTitle>
        <ProLockCard size={170} />
      </DialogContent>
    </Dialog>
  );
}
