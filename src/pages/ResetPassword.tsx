import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n";

// Reached from the password-reset email. Our auth-email-hook links here with
// ?token_hash=…&type=recovery (our own domain, no Supabase address). The
// one-time token is only used when the learner presses Save — so an email
// scanner opening the link can't use it up. Older links (Supabase's verify
// URL) arrive with a session already made by detectSessionInUrl; a signed-in
// learner (e.g. a Google account adding a password) can use the page too.
const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const navigate = useNavigate();
  const { t } = useT();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash");
  const isRecoveryLink = !!tokenHash && params.get("type") === "recovery";

  useEffect(() => {
    if (isRecoveryLink) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setInvalid(true);
    });
  }, [isRecoveryLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isRecoveryLink && !(await supabase.auth.getSession()).data.session) {
      const { error: linkError } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "recovery" });
      if (linkError) {
        setLoading(false);
        setInvalid(true); // expired or already used: offer a new link
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("passwordUpdated"), description: t("passwordUpdatedDesc") });
      // The learner is signed in now: open the app, not the sign-in page.
      navigate("/discover", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <BrandMark variant="lockup" size={44} className="mx-auto mb-5" />
          <h1 className="text-3xl font-bold text-foreground">{t("newPasswordTitle")}</h1>
          <p className="text-muted-foreground mt-2">{t("newPasswordSub")}</p>
        </div>

        <div className="glass-panel-strong p-8 space-y-4">
          {invalid ? (
            <div className="space-y-4 text-center">
              <p className="text-destructive text-sm">{t("invalidResetLink")}</p>
              <Button type="button" variant="hero" size="lg" className="w-full" onClick={() => navigate("/auth?mode=forgot", { replace: true })}>
                {t("sendResetLink")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder={t("newPassword")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10 bg-secondary/50 border-border"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || !ready}>
                {loading ? t("loading") : t("updatePassword")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
