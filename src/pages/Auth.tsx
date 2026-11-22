import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, User } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { UiLanguageSwitcher } from "@/components/UiLanguageSwitcher";
import { applyGuestOnboarding } from "@/lib/guestOnboarding";
import { GOOGLE_WEB_CLIENT_ID, canUseGoogleButton, googleCredentialHash, loadGoogleScript, makeNonce, signInWithGoogleCredential, signInWithLovableGoogle } from "@/lib/googleSignIn";
import { isPhoneGoogleState, phoneGoogleReturn } from "@linguascript/core/phoneGoogle";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className="mr-2 shrink-0">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
    </svg>
  );
}


// "Failed to fetch" means the browser never reached the login server
// (server paused/down, ad blocker, or network filter) — say that plainly.
const authErrorMessage = (e: { message?: string } | null | undefined) => {
  const msg = e?.message ?? "Please try again";
  return /failed to fetch|networkerror|load failed|network request failed/i.test(msg)
    ? "Couldn't reach the LinguaScript server. Check your internet, turn off ad blockers for this site, and try again in a minute."
    // Accounts made with "Continue with Google" have no password yet, so a
    // password Chrome remembered from elsewhere is "invalid". Say so.
    : /invalid login credentials/i.test(msg)
      ? "Wrong email or password. If you usually sign in with Google, you don't have a password yet: tap \"Forgot password?\" to make one."
      : /email not confirmed/i.test(msg)
        ? "Please confirm your email first: open the link we emailed you, then sign in."
        : msg;
};

const Auth = () => {
  // ?mode=signup / ?mode=forgot open those forms directly (links from the
  // Chrome extension and emails).
  const initialMode = new URLSearchParams(window.location.search).get("mode");
  const [isLogin, setIsLogin] = useState(initialMode !== "signup");
  const [forgotMode, setForgotMode] = useState(initialMode === "forgot");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const next = searchParams.get("next") || "/discover";
  const { toast } = useToast();
  const phoneState = searchParams.get("phone");
  const pendingPhoneState = useRef("");

  // Never open the backend-address OAuth screen: phones use our page in a real browser.
  const handleGoogleFallback = async () => {
    setGoogleLoading(true);
    try {
      if (inviteToken) localStorage.setItem("pendingSchoolInvite", inviteToken);
      if (next && next !== "/discover") localStorage.setItem("pendingAuthNext", next);
      const bridge = (window as any).ReactNativeWebView;
      if (bridge) {
        const { raw } = await makeNonce();
        pendingPhoneState.current = raw;
        bridge.postMessage(JSON.stringify({ type: "google-signin", state: raw }));
      } else {
        await signInWithLovableGoogle();
        if ((await supabase.auth.getSession()).data.session) await finishSignIn();
      }
    } catch (e) {
      toast({
        title: "Google sign-in failed",
        description: authErrorMessage(e instanceof Error ? e : null),
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };



  const acceptInviteIfAny = async () => {
    if (!inviteToken) return;
    const { error } = await supabase.rpc("accept_school_invite", { _token: inviteToken });
    if (error) toast({ title: "Invite issue", description: error.message, variant: "destructive" });
    else toast({ title: "Joined your school", description: "Welcome to the class!" });
  };

  // After any sign-in that stays on this page (password, Google button):
  // join the class from an invite, then onboarding for new learners.
  const finishSignIn = async () => {
    await acceptInviteIfAny();
    // Returning learners go straight in — never back through onboarding.
    const { data: u } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles")
      .select("onboarded, cef_level").eq("user_id", u.user?.id ?? "").maybeSingle();
    const done = Boolean((prof as any)?.onboarded || (prof as any)?.cef_level)
      || (!!u.user && await applyGuestOnboarding(u.user.id));
    if (done) { try { localStorage.removeItem("ls.onboardingState.v1"); } catch { /* ignore */ } }
    navigate(done ? next : "/onboarding", { replace: true });
  };

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!(window as any).ReactNativeWebView || !pendingPhoneState.current ||
          detail?.state !== pendingPhoneState.current || typeof detail?.tokenHash !== "string") return;
      pendingPhoneState.current = "";
      void (async () => {
        setGoogleLoading(true);
        try {
          const { error } = await supabase.auth.verifyOtp({ token_hash: detail.tokenHash, type: "magiclink" });
          if (error) throw error;
          await finishSignIn();
        } catch {
        toast({ title: "Google sign-in failed", description: "Please try signing in again.", variant: "destructive" });
        } finally { setGoogleLoading(false); }
      })();
    };
    window.addEventListener("ls:phone-google-return", receive);
    return () => window.removeEventListener("ls:phone-google-return", receive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Google's own button (src/lib/googleSignIn.ts): Google shows linguascript.co.uk,
  // not the backend address. "off" opens our branded page in a real browser.
  //
  // canUseGoogleButton() checks window.ReactNativeWebView, which react-native-webview
  // injects into the page — but that can land a tick after this component's first
  // render. Checking it as a useState lazy initializer (synchronous, at the very
  // first render) raced that injection: inside the app it sometimes read as "not
  // in the app yet", locked "gis" into "loading" for good (useState's initializer
  // only runs once), and the Google script then got asked to render inside an
  // embedded WebView — which Google silently refuses, leaving the button stuck on
  // its loading skeleton forever. Checking again in an effect (always after mount,
  // so after that injection) fixes it.
  const [gis, setGis] = useState<"loading" | "ready" | "off" | "failed">("off");
  const gisRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef("");
  useEffect(() => {
    setGis(canUseGoogleButton() ? "loading" : "off");
  }, []);
  useEffect(() => {
    if (gis !== "loading") return;
    let alive = true;
    const setup = async () => {
      const google = await loadGoogleScript();
      const nonce = await makeNonce();
      if (!alive || !gisRef.current) return;
      nonceRef.current = nonce.raw;
      google.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        nonce: nonce.hashed,
        ux_mode: "popup",
        use_fedcm_for_button: true,
        itp_support: true,
        callback: async ({ credential }: { credential?: string }) => {
          if (!credential) return;
          setGoogleLoading(true);
          track("signup_started", { method: "google_button", mode: isLogin ? "login" : "signup" });
          try {
            if (isPhoneGoogleState(phoneState)) {
              const hash = await googleCredentialHash(credential, nonceRef.current);
              window.location.assign(phoneGoogleReturn(hash, phoneState));
              return;
            }
            // Never "Signing in…" forever: each step gets 20 s, then a clear error and a fresh try.
            const within = <T,>(p: Promise<T>, what: string) => Promise.race([
              p,
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} took too long. Check your connection and try again.`)), 20000)),
            ]);
            try {
              await within(signInWithGoogleCredential(credential, nonceRef.current), "Signing in with Google");
            } catch {
              // The branded check couldn't finish (google-auth not deployed): use
              // Lovable Cloud's Google login with our own Google client instead.
              await signInWithLovableGoogle();
              if (!(await supabase.auth.getSession()).data.session) return; // redirected to Google; we come back here
            }
            await within(finishSignIn(), "Opening your account");
          } catch (e) {
            toast({ title: "Google sign-in failed", description: e instanceof Error ? e.message : "Please try again", variant: "destructive" });
            setGoogleLoading(false);
            setGis("loading"); // fresh nonce for the next try
          }
        },
      });
      const width = Math.max(220, Math.min(400, Math.round(gisRef.current.getBoundingClientRect().width)));
      google.accounts.id.renderButton(gisRef.current, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width });
      setGis("ready");
    };
    setup().catch(() => { if (alive) setGis("failed"); }); // never fall back to the backend-address Google screen here
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: authErrorMessage(error), variant: "destructive" });
      } else {
        // Signed in; never leave the button spinning if opening the account stalls.
        await Promise.race([finishSignIn(), new Promise((r) => setTimeout(r, 20000))]);
      }
    } else {
      track("signup_started", { method: "email", mode: "signup" });
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo:
            window.location.origin +
            (inviteToken ? `/auth?invite=${inviteToken}` : "/discover"),
        },
      });
      if (error) {
        toast({ title: "Signup failed", description: authErrorMessage(error), variant: "destructive" });
      } else {
        toast({
          title: "Check your email ✉️",
          description: `We sent a confirmation link to ${email}. Click it to activate your account.`,
        });
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't send reset email", description: authErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: t("resetLinkSent"), description: t("resetLinkSentDesc", { email }) });
      setForgotMode(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-end mb-2"><UiLanguageSwitcher /></div>
          <BrandMark variant="lockup" size={44} className="mx-auto mb-5" />
          <h1 className="text-3xl font-bold text-foreground">
            {forgotMode ? t("resetPasswordTitle") : isLogin ? t("welcomeBack") : t("joinLs")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {forgotMode ? t("resetPasswordSub") : isLogin ? t("signInSub") : t("signUpSub")}
          </p>
          {/* Opened from the Chrome extension's "Continue with Google" (?ext=1):
              ExtensionAccountSync signs the extension in once this tab is signed in. */}
          {new URLSearchParams(window.location.search).get("ext") === "1" && (
            <p className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
              🧩 Sign in to connect your LinguaScript Chrome extension. We'll take you straight back to your video.
            </p>
          )}
        </div>

        {forgotMode ? (
          <div className="glass-panel-strong p-8 space-y-4">
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={t("email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-secondary/50 border-border"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? t("loading") : t("sendResetLink")}
              </Button>
            </form>
          </div>
        ) : (
          <div className="glass-panel-strong p-8 space-y-4">

            {/* Google Sign-In: Google's own button where allowed, else the redirect button */}
            {gis === "failed" && (
              <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => setGis("loading")}>
                Google sign-in didn’t load — try again
              </Button>
            )}
            {(gis === "loading" || gis === "ready") && (
              <div className="w-full space-y-2">
                <div ref={gisRef} aria-busy={gis === "loading"} className={`flex min-h-[44px] w-full justify-center ${googleLoading ? "pointer-events-none opacity-60" : ""}`} />
                {googleLoading && <p className="text-center text-xs text-muted-foreground">{t("signingIn")}</p>}
              </div>
            )}
            {gis === "off" && (
              <div className="relative w-full min-h-[44px]">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={handleGoogleFallback}
                  disabled={googleLoading}
                >
                  <GoogleIcon />
                  {googleLoading ? t("signingIn") : t("google")}
                </Button>
              </div>
            )}


            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{t("or")}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("displayName")}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10 bg-secondary/50 border-border"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={t("email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-secondary/50 border-border"
                />
              </div>
              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder={t("password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 bg-secondary/50 border-border"
                  />
                </div>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {t("forgotPassword")}
                  </button>
                )}
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? t("loading") : isLogin ? t("signIn") : t("createAccount")}
              </Button>
            </form>
          </div>
        )}

        <p className="text-center text-muted-foreground mt-6 text-sm">
          {forgotMode ? (
            <button
              onClick={() => setForgotMode(false)}
              className="text-primary hover:underline font-medium"
            >
              {t("backToSignIn")}
            </button>
          ) : (
            <>
              {isLogin ? t("noAccount") : t("haveAccount")}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? t("signUp") : t("signInLink")}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
