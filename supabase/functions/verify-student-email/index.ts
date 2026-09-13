// Student eligibility check. Ownership of the academic address is proven by
// the account itself: we read the caller's verified Supabase identity rather
// than trusting a typed-in address, so nobody can claim the discount with
// someone else's university domain.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export function isAcademicEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return false;
  if (/\.(ac\.uk|edu|edu\.au|edu\.in|ac\.nz|edu\.sg|ac\.th|edu\.hk|ac\.jp)$/.test(domain)) return true;
  const sub = domain.split(".")[0];
  return ["uni", "university", "college", "students", "student"].includes(sub);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user } } = token
    ? await supabase.auth.getUser(token)
    : { data: { user: null } };

  if (!user?.email) {
    return new Response(
      JSON.stringify({ eligible: false, reason: "sign_in_required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const eligible = isAcademicEmail(user.email);
  return new Response(
    JSON.stringify({
      eligible,
      email: user.email,
      discountPercent: eligible ? 50 : 0,
      reason: eligible ? null : "not_academic_domain",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
