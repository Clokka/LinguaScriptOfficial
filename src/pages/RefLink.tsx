// /r/:code — a partner's link. Records one click (no IP, no personal data),
// remembers the partner for the sign-up (src/lib/referral.ts) and sends the
// visitor to the homepage. Tiny and lazy-loaded: only people who click a
// partner link ever download it.
import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageLoading } from "@/components/PageLoading";
import { supabase } from "@/integrations/supabase/client";
import { saveRef } from "@/lib/referral";
import { visitorId } from "@/lib/experiments";

export default function RefLink() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const ch = (params.get("ch") || params.get("utm_source") || "other").toLowerCase().slice(0, 20);
    const c = code.toLowerCase();
    saveRef(c, ch);
    const region = (Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown").split("/")[0];
    const device = window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
    const go = () => navigate(`/?ref=${encodeURIComponent(c)}&utm_source=${encodeURIComponent(ch)}&utm_medium=partner`, { replace: true });
    const t = setTimeout(go, 1500); // never keep a visitor waiting on the click log
    (supabase as any)
      .rpc("record_referral_click", { _code: c, _channel: ch, _path: "/", _visitor: visitorId(), _region: region, _device: device })
      .then(() => { clearTimeout(t); go(); }, () => { clearTimeout(t); go(); });
    return () => clearTimeout(t);
  }, [code, params, navigate]);

  return <PageLoading />;
}
