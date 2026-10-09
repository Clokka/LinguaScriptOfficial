import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n";

// Reached from the password-reset email link. Supabase appends a recovery
// token to the URL and exchanges it for a short-lived session automatically
// (via supabase-js's detectSessionInUrl) before this component mounts — so by
// the time we're here, supabase.auth.updateUser() is all that's needed to
// actually set the new password on that now-authenticated session.
const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const navigate = useNavigate();
  const { t } = useT();
  const { toast } = useToast();

  useEffect(() => {
    // A recovery link lands here already carrying a session if the token was
    // valid; anything else (expired/reused link) means no session appears.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setInvalid(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("passwordUpdated"), description: t("passwordUpdatedDesc") });
      navigate("/auth", { replace: true });
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
            <p className="text-center text-destructive text-sm">{t("invalidResetLink")}</p>
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
