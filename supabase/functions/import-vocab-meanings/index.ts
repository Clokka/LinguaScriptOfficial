// One-off importer: fills core_vocabulary.translation by id. Admin-only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => null);
  const rows = body?.rows;
  if (!Array.isArray(rows) || rows.length > 1000) return json({ error: "rows[] (max 1000) required" }, 400);
  let ok = 0;
  await Promise.all(
    rows.map(async (r: any) => {
      if (typeof r?.id !== "string" || typeof r?.t !== "string" || !r.t.trim()) return;
      const { error } = await admin
        .from("core_vocabulary")
        .update({ translation: r.t.trim().slice(0, 120) })
        .eq("id", r.id)
        .or("translation.is.null,translation.eq.");
      if (!error) ok++;
    }),
  );
  return json({ ok });
});
