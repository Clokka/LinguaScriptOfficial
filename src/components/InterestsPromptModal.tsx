import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { INTERESTS } from "@/lib/interests";
import { toast } from "sonner";

const DISMISS_KEY = "ls.interestsPrompt.dismissed.v1";

export const InterestsPromptModal = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("interests, onboarded")
        .eq("user_id", user.id)
        .single();
      if (cancelled || !data) return;
      const hasInterests = Array.isArray((data as any).interests) && (data as any).interests.length > 0;
      const onboarded = !!(data as any).onboarded;
      const dismissed = typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1";
      if (onboarded && !hasInterests && !dismissed) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user, loading]);

  const toggle = (id: string) =>
    setSelected((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]);

  const save = async () => {
    if (!user || selected.length === 0) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ interests: selected } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error("Couldn't save — try again."); return; }
    toast.success("Recommendations personalised ✨");
    setOpen(false);
  };

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-2xl bg-white text-neutral-900">
        <DialogHeader>
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200/70 rounded-full px-3 py-1 mb-2 text-orange-600 text-xs font-medium w-fit">
            <Sparkles className="w-3.5 h-3.5" /> Personalise your feed
          </div>
          <DialogTitle className="text-2xl">Help us personalise your recommendations</DialogTitle>
          <DialogDescription>
            Pick what you enjoy watching. We'll surface YouTube videos in your learning language
            that match your interests.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {INTERESTS.map((interest) => {
            const active = selected.includes(interest.id);
            return (
              <button
                key={interest.id}
                type="button"
                onClick={() => toggle(interest.id)}
                className={`relative rounded-xl border p-3 flex flex-col items-center justify-center gap-1.5 transition text-center min-h-[88px] ${
                  active
                    ? "bg-orange-500 border-orange-500 text-white shadow-[0_8px_20px_-10px_rgba(249,115,22,0.7)]"
                    : "bg-white border-orange-100 text-neutral-800 hover:border-orange-300"
                }`}
              >
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white text-orange-500 flex items-center justify-center">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                )}
                <span className="text-2xl leading-none">{interest.emoji}</span>
                <span className="text-xs font-medium">{interest.label}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={dismiss} className="rounded-full">Not now</Button>
          <Button
            onClick={save}
            disabled={selected.length === 0 || saving}
            className="rounded-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? "Saving…" : `Save${selected.length ? ` (${selected.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InterestsPromptModal;
