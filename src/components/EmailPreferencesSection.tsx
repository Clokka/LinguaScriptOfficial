import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Prefs = {
  review_reminders: boolean;
  streak_rescue: boolean;
  friend_requests: boolean;
  weekly_report: boolean;
  monthly_report: boolean;
  rank_overtaken: boolean;
};

const DEFAULTS: Prefs = {
  review_reminders: true, streak_rescue: true, friend_requests: true,
  weekly_report: true, monthly_report: true, rank_overtaken: false,
};

const ROWS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "review_reminders", label: "Review reminders", desc: "When 5+ flashcards are ready and you've been away ~24h. Max 3/week." },
  { key: "streak_rescue", label: "Streak rescue", desc: "One nudge before a 3+ day streak ends." },
  { key: "friend_requests", label: "Friend requests", desc: "Someone adds you or accepts your request." },
  { key: "weekly_report", label: "Weekly progress", desc: "Sunday summary of XP, reviews and words." },
  { key: "monthly_report", label: "Monthly recap", desc: "Once a month — how far you've come." },
  { key: "rank_overtaken", label: "Someone passes you (off by default)", desc: "Alert when a learner overtakes you on the leaderboard." },
];

export const EmailPreferencesSection = ({ userId }: { userId: string }) => {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email_prefs, show_on_global_leaderboard, discoverable_by_search")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancel) return;
      const p = (data as any)?.email_prefs;
      setPrefs({ ...DEFAULTS, ...(p ?? {}) });
      setShowOnLeaderboard((data as any)?.show_on_global_leaderboard ?? true);
      setDiscoverable((data as any)?.discoverable_by_search ?? true);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [userId]);

  const togglePref = async (key: keyof Prefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaving(true);
    const { error } = await supabase.rpc("update_email_prefs", { _prefs: { [key]: value } as any });
    setSaving(false);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
  };

  const togglePrivacy = async (next: { show?: boolean; discover?: boolean }) => {
    const show = next.show ?? showOnLeaderboard;
    const disc = next.discover ?? discoverable;
    setShowOnLeaderboard(show); setDiscoverable(disc);
    setSaving(true);
    const { error } = await supabase.rpc("update_privacy_settings", {
      _show_on_leaderboard: show, _discoverable: disc,
    } as any);
    setSaving(false);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
  };

  if (loading) {
    return <div className="pt-4 border-t border-border/50 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading preferences…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Privacy</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Control who can see you on LinguaScript.</p>
        <PrivacyRow
          label="Appear on the public LinguaScript leaderboard"
          desc="Compete with other learners, earn XP, build streaks, and climb the rankings."
          value={showOnLeaderboard}
          onChange={(v) => togglePrivacy({ show: v })}
        />
        <PrivacyRow
          label="Discoverable by search"
          desc="Other learners can find you by username or in the global tab."
          value={discoverable}
          onChange={(v) => togglePrivacy({ discover: v })}
        />
        {!showOnLeaderboard && (
          <div className="mt-3 rounded-xl bg-muted/40 border border-border/40 p-3 text-xs text-muted-foreground leading-relaxed">
            You're hidden from public leaderboards, XP rankings and friend discovery. Existing friends can still see your profile.
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Email preferences</p>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground mb-4">We cap retention emails at 1–3/week for active users. No daily noise.</p>
        <div className="space-y-3">
          {ROWS.map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
              <Switch checked={!!prefs[r.key]} onCheckedChange={(v) => togglePref(r.key, v)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PrivacyRow = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <div className="min-w-0">
      <p className="text-sm text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
    <Switch checked={value} onCheckedChange={onChange} />
  </div>
);
