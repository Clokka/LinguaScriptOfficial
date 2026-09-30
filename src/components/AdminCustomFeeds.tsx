import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { fetchCustomFeedTopics, type CustomFeedTopic } from "@/lib/customFeedTopics";

interface SearchRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
}

const EMPTY_FORM = { label: "", emoji: "✨", lang: "it", phrases: "", fallback: "" };

// Filled in by "Use example" so the shape of a good topic is obvious.
const EXAMPLE_FORM = {
  label: "Pottery",
  emoji: "🏺",
  lang: "it",
  phrases: "ceramica al tornio per principianti\ncome centrare l'argilla al tornio\nsmaltatura ceramica",
  fallback: "pottery wheel throwing",
};

/**
 * Hand-build a learner's recommendation feed: give one account its own topic
 * rails with exact search phrases (public.custom_feed_topics). Shown at the
 * top of that learner's Discover page by PersonalizedRails.
 */
export function AdminCustomFeeds() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchRow | null>(null);
  const [topics, setTopics] = useState<CustomFeedTopic[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  const runSearch = async () => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    const { data, error } = await (supabase as any).rpc("admin_search_users", { _q: query.trim() });
    setSearching(false);
    if (error) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
      return;
    }
    setResults((data as SearchRow[]) ?? []);
  };

  const loadTopics = async (userId: string) => setTopics(await fetchCustomFeedTopics(userId));

  const choose = async (row: SearchRow) => {
    setSelected(row);
    setResults([]);
    setForm(EMPTY_FORM);
    await loadTopics(row.user_id);
  };

  const addTopic = async () => {
    if (!selected) return;
    const label = form.label.trim();
    let lang = form.lang.trim().toLowerCase();
    const phrases = form.phrases.split("\n").map((p) => p.trim()).filter(Boolean).slice(0, 3);
    const fallback = form.fallback.trim();
    if (!label) { toast({ title: "Give the topic a name", variant: "destructive" }); return; }
    if (phrases.length === 0 && !fallback) {
      toast({ title: "Add at least one search phrase", variant: "destructive" });
      return;
    }
    if (phrases.length > 0 && !lang) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("learning_language")
        .eq("user_id", selected.user_id)
        .maybeSingle();
      lang = String((prof as any)?.learning_language || "").toLowerCase();
      if (!lang) {
        toast({ title: "Type the language code in the small box", description: "e.g. it, fr, es — next to the topic name", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("custom_feed_topics").insert({
      user_id: selected.user_id,
      label,
      emoji: form.emoji.trim() || "✨",
      queries: phrases.length ? { [lang]: phrases } : {},
      fallback_query: fallback || null,
      position: topics.length,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save topic", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Topic added", description: `${label} is now at the top of their Discover feed.` });
    setForm(EMPTY_FORM);
    await loadTopics(selected.user_id);
  };

  const removeTopic = async (topic: CustomFeedTopic) => {
    setBusy(topic.id);
    const { error } = await (supabase as any).from("custom_feed_topics").delete().eq("id", topic.id);
    setBusy(null);
    if (error) {
      toast({ title: "Couldn't remove topic", description: error.message, variant: "destructive" });
      return;
    }
    if (selected) await loadTopics(selected.user_id);
  };

  if (!isAdmin) return null;

  return (
    <div className="glass-panel-strong p-6 mb-8 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Wand2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Custom feeds</h2>
          <p className="text-xs text-muted-foreground">
            Build one learner's video feed by hand. Their topics show first on Discover, searched on YouTube exactly as written.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Find a learner by email, username, or display name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void runSearch(); } }}
          className="bg-secondary/50 border-border"
        />
        <Button variant="hero" onClick={runSearch} disabled={searching} className="gap-2">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <button
              key={r.user_id}
              onClick={() => void choose(r)}
              className="glass-panel p-3 w-full text-left hover:border-emerald-500/40 transition-colors"
            >
              <p className="text-sm text-foreground truncate">{r.display_name || r.username || r.email || r.user_id}</p>
              <p className="text-xs text-muted-foreground truncate">{r.email}</p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Feed for <span className="font-semibold">{selected.display_name || selected.username || selected.email}</span>
            {selected.email && <span className="text-muted-foreground"> · {selected.email}</span>}
          </p>

          <div className="space-y-2">
            {topics.length === 0 && (
              <p className="text-xs text-muted-foreground">No custom topics yet. Their feed uses their onboarding interests.</p>
            )}
            {topics.map((t) => (
              <div key={t.id} className="glass-panel p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-foreground">{t.emoji} {t.label}</p>
                  {Object.entries(t.queries || {}).map(([lang, qs]) => (
                    <p key={lang} className="text-xs text-muted-foreground break-words">
                      <span className="uppercase font-semibold">{lang}</span>: {qs.join(" · ")}
                    </p>
                  ))}
                  {t.fallback_query && (
                    <p className="text-xs text-muted-foreground">Other languages: "&lt;Language&gt; {t.fallback_query}"</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => void removeTopic(t)} disabled={busy === t.id}>
                  {busy === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            ))}
          </div>

          <div className="glass-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Add a topic</p>
              <Button variant="ghost" size="sm" onClick={() => setForm(EXAMPLE_FORM)}>Use example</Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="🏺"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                className="bg-secondary/50 border-border w-16 text-center"
              />
              <Input
                placeholder="Topic name, e.g. Pottery"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="bg-secondary/50 border-border"
              />
              <Input
                placeholder="it"
                value={form.lang}
                onChange={(e) => setForm({ ...form, lang: e.target.value })}
                className="bg-secondary/50 border-border w-20"
                aria-label="Language code of the search phrases"
              />
            </div>
            <Textarea
              placeholder={"YouTube searches in that language, one per line (max 3)\nceramica al tornio per principianti"}
              value={form.phrases}
              onChange={(e) => setForm({ ...form, phrases: e.target.value })}
              className="bg-secondary/50 border-border min-h-[88px]"
            />
            <Input
              placeholder="Optional English fallback for other languages, e.g. pottery wheel throwing"
              value={form.fallback}
              onChange={(e) => setForm({ ...form, fallback: e.target.value })}
              className="bg-secondary/50 border-border"
            />
            <Button variant="hero" onClick={addTopic} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add topic
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
