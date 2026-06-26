// Discover storefront. Pulls EVERY public film from the Admin Dashboard
// (table: films, is_public=true). Filters by CEFR / category / language /
// search. New admin uploads appear automatically with no frontend changes.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Play, Sparkles, Clock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getLanguageLabel, getLanguageFlag, LANGUAGES } from "@/lib/languages";
import { computeVideoComprehension } from "@/lib/videoComprehension";
import { cn } from "@/lib/utils";

export interface DiscoverFilm {
  id: string;
  title: string;
  language: string | null;
  thumbnail_url: string | null;
  description?: string | null;
  difficulty?: string | null;
  cefr_level?: string | null;
  category?: string | null;
  tags?: string[] | null;
  duration_seconds?: number | null;
  created_at: string;
}

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];

function formatDuration(s?: number | null): string {
  if (!s || s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function isRecent(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 7 * 86400000;
}

export function DiscoverCatalog({ defaultLanguage }: { defaultLanguage: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [films, setFilms] = useState<DiscoverFilm[] | null>(null);
  const [comp, setComp] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [langFilter, setLangFilter] = useState<string>(defaultLanguage);
  const [cefrFilter, setCefrFilter] = useState<string>("__all__");
  const [catFilter, setCatFilter] = useState<string>("__all__");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("films")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false });
      if (!alive) return;
      setFilms((data as any[]) || []);
    })();
    return () => { alive = false; };
  }, []);

  // Compute estimated comprehension for visible films (sampled, bounded).
  useEffect(() => {
    if (!films) return;
    const sample = films.slice(0, 24);
    let alive = true;
    (async () => {
      const entries: [string, number][] = [];
      for (const f of sample) {
        if (comp[f.id] !== undefined) continue;
        const c = await computeVideoComprehension(user?.id ?? null, f.id, f.language || defaultLanguage);
        if (!alive) return;
        entries.push([f.id, c.pct]);
      }
      if (entries.length) setComp((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => { alive = false; };
  }, [films, user, defaultLanguage]);

  const categories = useMemo(() => {
    if (!films) return [];
    const set = new Set<string>();
    for (const f of films) if (f.category) set.add(f.category);
    return Array.from(set).sort();
  }, [films]);

  const filtered = useMemo(() => {
    if (!films) return [];
    const q = query.trim().toLowerCase();
    return films.filter((f) => {
      if (langFilter !== "__all__" && (f.language || "") !== langFilter) return false;
      if (cefrFilter !== "__all__" && (f.cefr_level || "").toUpperCase() !== cefrFilter) return false;
      if (catFilter !== "__all__" && (f.category || "") !== catFilter) return false;
      if (q) {
        const hay = `${f.title} ${(f.tags || []).join(" ")} ${f.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [films, query, langFilter, cefrFilter, catFilter]);

  if (films === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Discover</h2>
        <p className="text-muted-foreground">A curated library — each video tracks your comprehension every time you watch.</p>
      </div>

      {/* Filters */}
      <div className="glass-panel-strong p-4 rounded-2xl space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, tag or description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 bg-secondary/50 border-border rounded-xl"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={langFilter} onValueChange={setLangFilter}>
            <SelectTrigger className="w-[170px] h-9 bg-secondary/40 border-border rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All languages</SelectItem>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cefrFilter} onValueChange={setCefrFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-secondary/40 border-border rounded-lg text-sm">
              <SelectValue placeholder="CEFR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All levels</SelectItem>
              {CEFR.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[170px] h-9 bg-secondary/40 border-border rounded-lg text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All categories</SelectItem>
                {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          {(query || cefrFilter !== "__all__" || catFilter !== "__all__" || langFilter !== defaultLanguage) && (
            <Button
              variant="ghost" size="sm"
              onClick={() => { setQuery(""); setCefrFilter("__all__"); setCatFilter("__all__"); setLangFilter(defaultLanguage); }}
              className="h-9 gap-1 text-xs"
            >
              <Filter className="w-3 h-3" /> Reset
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl">
          <p className="text-muted-foreground">No content matches these filters yet. Try widening the search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((f) => (
            <DiscoverCard key={f.id} film={f} estimated={comp[f.id]} onOpen={() => navigate(`/watch/${f.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoverCard({ film, estimated, onOpen }: { film: DiscoverFilm; estimated?: number; onOpen: () => void }) {
  const recent = isRecent(film.created_at);
  const dur = formatDuration(film.duration_seconds);
  const cefr = (film.cefr_level || "").toUpperCase();
  return (
    <button onClick={onOpen} className="group text-left">
      <div className="relative rounded-xl overflow-hidden aspect-video bg-secondary mb-2 border border-border group-hover:border-primary/50 transition-all">
        {film.thumbnail_url ? (
          <img src={film.thumbnail_url} alt={film.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-muted-foreground" /></div>
        )}
        {recent && (
          <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/90 text-white shadow-sm">
            <Sparkles className="w-2.5 h-2.5" /> New
          </div>
        )}
        {cefr && (
          <div className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
            {cefr}
          </div>
        )}
        {dur && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> {dur}
          </div>
        )}
        {estimated !== undefined && (
          <div className="absolute bottom-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/90 text-white">
            ~{estimated}%
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
          </div>
        </div>
      </div>
      <p className="text-sm text-foreground line-clamp-2 font-medium leading-snug">{film.title}</p>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 flex-wrap">
        <span>{getLanguageFlag(film.language ?? "fr")} {getLanguageLabel(film.language ?? "fr")}</span>
        {film.category && <span>· {film.category}</span>}
      </div>
      {film.tags && film.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {film.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
