import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Layers, Shield, Check, X } from "lucide-react";

type AuthorizationDetails = {
  client?: { name?: string; client_name?: string; redirect_uris?: string[] };
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};

// Local typed wrapper for beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
        return;
      }
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, navigate]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";
  const scopeList =
    details?.scopes ??
    (details?.scope ? details.scope.split(/\s+/).filter(Boolean) : ["openid", "email", "profile"]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-primary mx-auto mb-4">
            <Layers className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Connect {clientName} to LinguaScript
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This lets {clientName} use LinguaScript as you.
          </p>
        </div>

        <div className="glass-panel-strong p-6 space-y-5">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}

          {!details && !error && (
            <div className="text-sm text-muted-foreground">Loading authorization…</div>
          )}

          {details && (
            <>
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-2">What it can access</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {scopeList.includes("profile") && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-primary" /> Your basic profile
                    </li>
                  )}
                  {scopeList.includes("email") && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-primary" /> Your email address
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-primary" />
                    Call LinguaScript tools on your behalf (view progress, saved words, and save new flashcards).
                  </li>
                </ul>
              </div>

              <div className="text-xs text-muted-foreground flex items-start gap-2 bg-secondary/40 rounded-md p-3">
                <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  This does not bypass LinguaScript's permissions. {clientName} can only see and
                  do what your account already can.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(true)}
                >
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
