import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Root route: unauthenticated visitors land on /landingpage2.
// Authenticated users go to /discover — unless they've never completed
// onboarding (e.g. brand-new Google sign-ups), in which case they are
// sent through the onboarding flow first.
const Index = () => {
  const { user, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setOnboarded(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setOnboarded(Boolean((data as { onboarded?: boolean } | null)?.onboarded));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/landingpage2" replace />;
  if (onboarded === null) return null;
  return <Navigate to={onboarded ? "/discover" : "/onboarding"} replace />;
};

export default Index;
