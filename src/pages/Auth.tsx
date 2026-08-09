import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Mail, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" className="mr-2 shrink-0">
      <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
      <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.3 6.3 14.7z"/>
      <path fill="#FBBC05" d="M24 46c5.8 0 10.8-1.9 14.8-5.2l-6.8-5.6C30 36.7 27.1 37.5 24 37.5c-6.1 0-11.2-4.1-13-9.7l-7 5.4C7.5 41.2 15.2 46 24 46z"/>
      <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.3 5.8l6.8 5.6C42.2 36.3 46 30.7 46 24c0-1.3-.2-2.7-.5-4z"/>
    </svg>
  );
}


const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gisReady, setGisReady] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const next = searchParams.get("next") || "/discover";
  const { toast } = useToast();

  // GIS appends its iframe into this div — must start EMPTY
  const googleBtnRef = useRef<HTMLDivElement>(null);
  // Stable ref so the GIS callback always sees fresh state
  const ctxRef = useRef({ inviteToken, next, navigate, toast });
  ctxRef.current = { inviteToken, next, navigate, toast };

  useEffect(() => {
    const handleCredential = async (response: { credential: string }) => {
      setGoogleLoading(true);
      const { inviteToken, next, navigate, toast } = ctxRef.current;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/google-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Google auth failed");

        const { error: verifyErr } = await supabase.auth.verifyOtp({
          email: data.email,
          token: data.token_hash,
          type: "magiclink",
        });
        if (verifyErr) throw new Error(verifyErr.message);

        if (inviteToken) {
          const { error: inviteErr } = await supabase.rpc("accept_school_invite", { _token: inviteToken });
          if (!inviteErr) toast({ title: "Joined your school", description: "Welcome to the class!" });
        }
        navigate(next);
      } catch (e: any) {
        toast({ title: "Google sign-in failed", description: e.message, variant: "destructive" });
        setGoogleLoading(false);
      }
    };

    const doRender = () => {
      const el = googleBtnRef.current;
      if (!window.google?.accounts?.id || !el) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
      });

      // Width must be a number; read the real layout width (el is always in the DOM)
      const w = el.getBoundingClientRect().width || 400;
      window.google.accounts.id.renderButton(el, {
        theme: "outline",
        size: "large",
        width: Math.min(Math.floor(w), 400),
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
      });

      setGisReady(true);
    };

    if (window.google?.accounts?.id) { doRender(); return; }

    const SCRIPT_ID = "gsi-client";
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = doRender;
      document.head.appendChild(s);
    } else {
      const iv = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(iv); doRender(); }
      }, 50);
      return () => clearInterval(iv);
    }
  }, []);

  // Fallback path when the Google Identity Services iframe can't render
  // (blocked script, in-app browser, embedded preview). Uses Lovable's
  // managed OAuth broker instead.
  const handleGoogleFallback = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(String(result.error));
      if (result.redirected) return;
      if (inviteToken) {
        await supabase.rpc("accept_school_invite", { _token: inviteToken });
      }
      navigate(next);
    } catch (e) {
      toast({
        title: "Google sign-in failed",
        description: e instanceof Error ? e.message : "Please try again",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        await acceptInviteIfAny();
        navigate(next);
      }
    } else {
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
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-primary mx-auto mb-4">
            <Layers className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {isLogin ? "Welcome back" : "Join LinguaScript"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? "Sign in to continue learning" : "Create your account to start learning"}
          </p>
        </div>

        <div className="glass-panel-strong p-8 space-y-4">

          {/* Google Sign-In */}
          <div className="relative w-full min-h-[44px]">
            {/* Fallback button — clickable, used until (or instead of) the GIS iframe */}
            {!gisReady && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                onClick={handleGoogleFallback}
                disabled={googleLoading}
              >
                <GoogleIcon />
                Continue with Google
              </Button>
            )}

            {/* Loading overlay during sign-in */}
            {googleLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md z-20">
                <span className="text-sm text-gray-600">Signing in…</span>
              </div>
            )}

            {/*
              GIS appends its iframe into this div.
              It must be EMPTY (no children) and always in the DOM.
              We keep it at 0 height before ready so it doesn't
              appear as a duplicate element below the placeholder.
            */}
            <div
              ref={googleBtnRef}
              className="flex justify-center overflow-hidden"
              style={{ height: gisReady ? "auto" : 0 }}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Display name"
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
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 bg-secondary/50 border-border"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10 bg-secondary/50 border-border"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-muted-foreground mt-6 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
