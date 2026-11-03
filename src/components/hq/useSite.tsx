// HQ: read what's live, team drafts and history; publish with a "Are you
// sure?" step. Shared by the HQ page, its Studio tab and the Partners page.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cleanConfig, DEFAULT_SITE, writeCache, type SiteConfig } from "@/lib/site/config";

export type Draft = { id: string; name: string; config: any; updated_at: string };
export type Publish = { id: number; config: SiteConfig; note: string | null; published_by_email: string | null; created_at: string };
export type Pending = { title: string; lines: string[]; config: SiteConfig; note?: string };

const db = supabase as any;

export function useSite() {
  const [live, setLive] = useState<SiteConfig | null | undefined>(undefined);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [history, setHistory] = useState<Publish[]>([]);

  const reload = useCallback(async () => {
    const [l, d, h] = await Promise.all([
      db.rpc("get_live_site"),
      db.from("site_drafts").select("id,name,config,updated_at").order("updated_at", { ascending: false }),
      db.rpc("site_publish_history", { _limit: 30 }),
    ]);
    if (l.error) toast.error(`Couldn't read the live site: ${l.error.message}`);
    setLive(cleanConfig(l.data));
    setDrafts((d.data as Draft[]) ?? []);
    setHistory(((h.data as Publish[]) ?? []).map((p) => ({ ...p, config: cleanConfig(p.config) ?? p.config })));
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  /** The live config, or the built-in default when nothing has been published. */
  const base = (): SiteConfig => JSON.parse(JSON.stringify(live ?? DEFAULT_SITE));

  const publish = async (config: SiteConfig, note?: string) => {
    const clean = cleanConfig(config);
    if (!clean) { toast.error("That setup isn't complete yet."); return false; }
    const { error } = await db.rpc("publish_site", { _config: clean, _note: note || null });
    if (error) {
      toast.error(/schema cache|does not exist|Could not find the function/i.test(error.message)
        ? "HQ isn't switched on in the database yet. Run docs/sql/hq-step-1-roles.sql, then hq-step-2-tables.sql, in the Supabase SQL Editor."
        : error.message, { duration: 12000 });
      return false;
    }
    writeCache(clean); // this device sees it straight away
    toast.success("Live! Visitors get it from their next page load.");
    await reload();
    return true;
  };

  const saveDraft = async (name: string, config: unknown, quiet = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    const existing = drafts.find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
    const row = { name: name.trim().slice(0, 80), config, updated_by: user?.id ?? null, updated_at: new Date().toISOString() };
    const { error } = existing
      ? await db.from("site_drafts").update(row).eq("id", existing.id)
      : await db.from("site_drafts").insert(row);
    if (error) { toast.error(error.message); return false; }
    if (!quiet) toast.success(existing ? `Updated "${row.name}" for the team` : `Saved "${row.name}" for the team`);
    await reload();
    return true;
  };

  const deleteDraft = async (id: string) => {
    const { error } = await db.from("site_drafts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Draft deleted"); await reload(); }
  };

  return { live, drafts, history, reload, base, publish, saveDraft, deleteDraft };
}

/** "Are you sure?" before anything changes the real website. */
export function PublishDialog({ pending, onClose, publish }: {
  pending: Pending | null; onClose: () => void; publish: (c: SiteConfig, note?: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(pending?.note ?? ""); }, [pending]);
  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? "Go live?"}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <ul className="list-disc pl-5 space-y-1 text-foreground">{pending?.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              <p>This changes linguascript.co.uk for every visitor. You can roll back any time in <b>Go live → History</b>.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input placeholder="Note for the team (optional), e.g. 'Gold hero for TikTok push'" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-green-600 hover:bg-green-500 text-white"
            onClick={async (e) => {
              e.preventDefault();
              if (!pending) return;
              setBusy(true);
              const ok = await publish(pending.config, note);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy ? "Publishing…" : "OK, go live 🚀"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
