import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { parseSrt } from "@/lib/srtParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Film, Loader2, Upload, FileText, Check, Mail, Layers, X, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";

function RowHeader({ row, onRename, onDelete }: { row: { id: string; title: string }; onRename: (id: string, title: string) => void; onDelete: (id: string) => void; }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.title);
  useEffect(() => { setValue(row.title); }, [row.title]);
  const save = () => {
    const v = value.trim();
    if (v && v !== row.title) onRename(row.id, v);
    setEditing(false);
  };
  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <>
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") { setValue(row.title); setEditing(false); } }}
            className="bg-secondary/50 border-border font-medium"
          />
          <Button variant="hero" size="sm" onClick={save}>Save</Button>
          <Button variant="glass" size="sm" onClick={() => { setValue(row.title); setEditing(false); }}>Cancel</Button>
        </>
      ) : (
        <>
          <h3 className="flex-1 text-foreground font-medium truncate">{row.title}</h3>
          <Button variant="glass" size="icon" onClick={() => setEditing(true)} title="Rename">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="glass" size="icon" onClick={() => onDelete(row.id)} title="Delete">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
}

interface FilmRow {
  id: string;
  title: string;
  url: string;
  language: string | null;
  thumbnail_url: string | null;
  created_at: string;
  is_public?: boolean;
  subtitle_count?: number;
  subtitle_languages?: string[];
}

interface CatalogRow {
  id: string;
  title: string;
  sort_order: number;
  language: string | null;
  pins: { id: string; film_id: string; sort_order: number; film: FilmRow | null }[];
}

interface EmailSignup {
  id: string;
  email: string;
  created_at: string;
}

const Admin = () => {
  const [films, setFilms] = useState<FilmRow[]>([]);
  const [emails, setEmails] = useState<EmailSignup[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("es");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [srtFileOriginal, setSrtFileOriginal] = useState<File | null>(null);
  const [srtFileSecondary, setSrtFileSecondary] = useState<File | null>(null);
  const [secondaryLanguage, setSecondaryLanguage] = useState("en");
  const [uploadingSubsFor, setUploadingSubsFor] = useState<string | null>(null);
  const fileInputRefOriginal = useRef<HTMLInputElement>(null);
  const fileInputRefSecondary = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Catalog rows state
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [newRowTitle, setNewRowTitle] = useState("");
  const [newRowLang, setNewRowLang] = useState<string>("__all__");

  useEffect(() => {
    fetchFilms();
    fetchEmails();
    fetchCatalogRows();
  }, []);

  const fetchCatalogRows = async () => {
    const { data: rows } = await supabase.from("catalog_rows").select("*").order("sort_order");
    if (!rows) { setCatalogRows([]); return; }
    const withPins = await Promise.all(rows.map(async (r: any) => {
      const { data: pins } = await supabase
        .from("catalog_row_films")
        .select("id, film_id, sort_order, films(*)")
        .eq("row_id", r.id)
        .order("sort_order");
      return {
        id: r.id,
        title: r.title,
        sort_order: r.sort_order,
        language: r.language ?? null,
        pins: (pins || []).map((p: any) => ({ id: p.id, film_id: p.film_id, sort_order: p.sort_order, film: p.films })),
      } as CatalogRow;
    }));
    setCatalogRows(withPins);
  };

  const createCatalogRow = async () => {
    if (!newRowTitle.trim()) return;
    const { error } = await supabase.from("catalog_rows").insert({
      title: newRowTitle.trim(),
      sort_order: catalogRows.length,
      language: newRowLang === "__all__" ? null : newRowLang,
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewRowTitle("");
    fetchCatalogRows();
  };

  const setRowLanguage = async (id: string, language: string | null) => {
    await supabase.from("catalog_rows").update({ language } as any).eq("id", id);
    fetchCatalogRows();
  };

  const renameCatalogRow = async (id: string, title: string) => {
    await supabase.from("catalog_rows").update({ title }).eq("id", id);
    fetchCatalogRows();
  };

  const deleteCatalogRow = async (id: string) => {
    await supabase.from("catalog_rows").delete().eq("id", id);
    fetchCatalogRows();
  };

  const pinFilmToRow = async (rowId: string, filmId: string) => {
    const row = catalogRows.find((r) => r.id === rowId);
    const sort = row?.pins.length ?? 0;
    const { error } = await supabase.from("catalog_row_films").insert({ row_id: rowId, film_id: filmId, sort_order: sort });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    fetchCatalogRows();
  };

  const unpinFilm = async (pinId: string) => {
    await supabase.from("catalog_row_films").delete().eq("id", pinId);
    fetchCatalogRows();
  };

  const movePin = async (rowId: string, pinId: string, dir: -1 | 1) => {
    const row = catalogRows.find((r) => r.id === rowId);
    if (!row) return;
    const idx = row.pins.findIndex((p) => p.id === pinId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= row.pins.length) return;
    const a = row.pins[idx]; const b = row.pins[swapIdx];
    await supabase.from("catalog_row_films").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("catalog_row_films").update({ sort_order: a.sort_order }).eq("id", b.id);
    fetchCatalogRows();
  };

  const togglePublish = async (film: FilmRow) => {
    await supabase.from("films").update({ is_public: !film.is_public }).eq("id", film.id);
    fetchFilms();
  };

  const fetchEmails = async () => {
    const { data } = await supabase.from("email_signups").select("*").order("created_at", { ascending: false });
    if (data) setEmails(data);
  };

  const fetchFilms = async () => {
    const { data } = await supabase.from("films").select("*").order("created_at", { ascending: false });
    if (data) {
      const filmsWithCounts = await Promise.all(
        data.map(async (film) => {
          const { data: langCounts } = await supabase
            .from("subtitles")
            .select("language")
            .eq("film_id", film.id);
          const langs = new Set((langCounts || []).map((s: { language: string }) => s.language));
          return {
            ...film,
            subtitle_count: langCounts?.length ?? 0,
            subtitle_languages: Array.from(langs),
          };
        })
      );
      setFilms(filmsWithCounts as any);
    }
    setLoading(false);
  };

  const parseSrtAndUpload = async (filmId: string, file: File, lang: string) => {
    const content = await file.text();
    const entries = parseSrt(content);

    if (entries.length === 0) {
      toast({ title: "Invalid SRT file", description: "No valid subtitle entries found.", variant: "destructive" });
      return false;
    }

    // Delete existing subtitles for this film + language
    await supabase.from("subtitles").delete().eq("film_id", filmId).eq("language", lang);

    // Insert in batches of 100
    for (let i = 0; i < entries.length; i += 100) {
      const batch = entries.slice(i, i + 100).map((entry, idx) => ({
        film_id: filmId,
        start_time: entry.startTime,
        end_time: entry.endTime,
        text: entry.text,
        sort_order: i + idx,
        language: lang,
      }));
      const { error } = await supabase.from("subtitles").insert(batch);
      if (error) {
        toast({ title: "Error uploading subtitles", description: error.message, variant: "destructive" });
        return false;
      }
    }

    toast({ title: `${entries.length} ${lang.toUpperCase()} subtitles uploaded!` });
    return true;
  };

  const addFilm = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);

    // Auto-generate YouTube thumbnail if not provided
    let thumb = thumbnailUrl || null;
    if (!thumb) {
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/))([^&?\s]+)/);
      if (ytMatch) {
        thumb = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
      }
    }

    // Get current user (RLS now requires auth + records owner)
    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("films").insert({
      title,
      url,
      language,
      thumbnail_url: thumb,
      is_public: true,
      created_by: authData.user?.id ?? null,
    }).select().single();

    if (error) {
      toast({ title: "Error adding film", description: error.message, variant: "destructive" });
    } else {
      if (srtFileOriginal && data) {
        await parseSrtAndUpload(data.id, srtFileOriginal, language);
      }
      if (srtFileSecondary && data) {
        await parseSrtAndUpload(data.id, srtFileSecondary, secondaryLanguage);
      }
      toast({ title: "Film added!" });
      setTitle("");
      setUrl("");
      setThumbnailUrl("");
      setSrtFileOriginal(null);
      setSrtFileSecondary(null);
      if (fileInputRefOriginal.current) fileInputRefOriginal.current.value = "";
      if (fileInputRefSecondary.current) fileInputRefSecondary.current.value = "";
      fetchFilms();
    }
    setAdding(false);
  };

  const handleUploadSubsForExisting = async (filmId: string, file: File, lang: string) => {
    setUploadingSubsFor(filmId);
    await parseSrtAndUpload(filmId, file, lang);
    setUploadingSubsFor(null);
    fetchFilms();
  };

  const deleteFilm = async (id: string) => {
    await supabase.from("films").delete().eq("id", id);
    fetchFilms();
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <Button variant="glass" onClick={() => navigate("/")} className="mb-8 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground mb-8">Add films and upload subtitle tracks, or let fetched YouTube captions auto-save here per film.</p>

        {/* Add Film Form */}
        <form onSubmit={addFilm} className="glass-panel-strong p-6 space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Add New Film
          </h2>
          <Input
            placeholder="Film title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="bg-secondary/50 border-border"
          />
          <Input
            placeholder="YouTube URL (e.g. https://youtu.be/...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="bg-secondary/50 border-border"
          />
          <Input
            placeholder="Thumbnail URL (auto-generated from YouTube if empty)"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            className="bg-secondary/50 border-border"
          />
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue placeholder="Film language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.flag} {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Original SRT Upload (matches film language) */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" /> Original subtitles (.srt) — {LANGUAGES.find(l => l.code === language)?.label || language} — optional
            </label>
            <div className="flex items-center gap-3">
              <Input
                ref={fileInputRefOriginal}
                type="file"
                accept=".srt"
                onChange={(e) => setSrtFileOriginal(e.target.files?.[0] ?? null)}
                className="bg-secondary/50 border-border"
              />
              {srtFileOriginal && (
                <span className="text-xs text-primary flex items-center gap-1 whitespace-nowrap">
                  <Check className="w-3 h-3" /> {srtFileOriginal.name}
                </span>
              )}
            </div>
          </div>

          {/* Second-language SRT Upload */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" /> Second-language subtitles (.srt) — optional
            </label>
            <div className="flex items-center gap-3">
              <Select value={secondaryLanguage} onValueChange={setSecondaryLanguage}>
                <SelectTrigger className="bg-secondary/50 border-border w-[160px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.filter(l => l.code !== language).map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.flag} {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                ref={fileInputRefSecondary}
                type="file"
                accept=".srt"
                onChange={(e) => setSrtFileSecondary(e.target.files?.[0] ?? null)}
                className="bg-secondary/50 border-border"
              />
              {srtFileSecondary && (
                <span className="text-xs text-primary flex items-center gap-1 whitespace-nowrap">
                  <Check className="w-3 h-3" /> {srtFileSecondary.name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload SRT pairs per film. Library films use only these uploaded subtitles — they are never auto-translated or auto-fetched.
            </p>
          </div>

          <Button type="submit" variant="hero" disabled={adding} className="gap-2">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Film
          </Button>
        </form>

        {/* Films List */}
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Films ({films.length})
        </h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : films.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <Film className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No films added yet. Add one above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {films.map((film) => (
              <div key={film.id} className="glass-panel p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {film.thumbnail_url ? (
                      <img
                        src={film.thumbnail_url}
                        alt={film.title}
                        className="w-16 h-10 rounded-lg object-cover bg-secondary"
                      />
                    ) : (
                      <div className="w-16 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        <Film className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-foreground font-medium truncate">{film.title}</p>
                      <p className="text-muted-foreground text-xs truncate">{film.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="glass" size="sm" onClick={() => togglePublish(film)} className="gap-1 text-xs">
                      {film.is_public ? <><Eye className="w-3.5 h-3.5 text-primary" /> Public</> : <><EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Private</>}
                    </Button>
                    <Button variant="glass" size="icon" onClick={() => deleteFilm(film.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {/* Subtitle status + per-language upload */}
                <div className="flex flex-col gap-2 pl-20">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(film.subtitle_languages ?? []).length > 0 ? (
                      <span className="text-primary">
                        ✓ Subtitles: {(film.subtitle_languages ?? []).map(l => l.toUpperCase()).join(", ")}
                      </span>
                    ) : (
                      "No subtitles uploaded"
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const orig = film.language || "fr";
                      const existing = film.subtitle_languages ?? [];
                      const secondaryExisting = existing.find((l) => l !== orig);
                      const slots: Array<{ lang: string; role: "Original" | "Second" }> = [
                        { lang: orig, role: "Original" },
                        { lang: secondaryExisting || (orig === "en" ? "fr" : "en"), role: "Second" },
                      ];
                      return slots.map((slot) => {
                        const hasLang = existing.includes(slot.lang);
                        const langInfo = LANGUAGES.find((l) => l.code === slot.lang);
                        const label = `${langInfo?.flag ?? ""} ${langInfo?.label ?? slot.lang.toUpperCase()}`;
                        return (
                          <div key={slot.role}>
                            <input
                              type="file"
                              accept=".srt"
                              className="hidden"
                              id={`srt-${film.id}-${slot.role}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadSubsForExisting(film.id, file, slot.lang);
                                requestAnimationFrame(() => { e.target.value = ""; });
                              }}
                            />
                            <Button
                              variant="glass"
                              size="sm"
                              className="gap-1 text-xs"
                              disabled={uploadingSubsFor === film.id}
                              onClick={() => document.getElementById(`srt-${film.id}-${slot.role}`)?.click()}
                            >
                              {uploadingSubsFor === film.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3" />
                              )}
                              {hasLang ? `Replace ${slot.role} (${label})` : `Upload ${slot.role} (${label})`}
                            </Button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Catalog Rows */}
        <h2 className="text-lg font-semibold text-foreground mb-2 mt-12 flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" /> Catalog Rows
        </h2>
        <p className="text-muted-foreground text-sm mb-4">Group public films into themed rows shown on the home page.</p>

        <div className="glass-panel-strong p-4 mb-4 flex flex-wrap gap-2">
          <Input
            placeholder="New row title (e.g. French Classics)"
            value={newRowTitle}
            onChange={(e) => setNewRowTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createCatalogRow())}
            className="bg-secondary/50 border-border min-w-[220px] flex-1"
          />
          <Select value={newRowLang} onValueChange={setNewRowLang}>
            <SelectTrigger className="bg-secondary/50 border-border w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">🌐 All languages</SelectItem>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.flag} {l.label} only</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={createCatalogRow} variant="hero" className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Row
          </Button>
        </div>

        <div className="space-y-4 mb-12">
          {catalogRows.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No rows yet — create your first one above.</p>
          )}
          {catalogRows.map((row) => {
            const pinnedIds = new Set(row.pins.map((p) => p.film_id));
            const availableFilms = films.filter((f) => f.is_public && !pinnedIds.has(f.id));
            return (
              <div key={row.id} className="glass-panel p-4 space-y-3">
                <RowHeader row={row} onRename={renameCatalogRow} onDelete={deleteCatalogRow} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Shown to:</span>
                  <Select
                    value={row.language ?? "__all__"}
                    onValueChange={(v) => setRowLanguage(row.id, v === "__all__" ? null : v)}
                  >
                    <SelectTrigger className="bg-secondary/50 border-border h-8 w-[200px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">🌐 All learners</SelectItem>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>{l.flag} {l.label} learners</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  {row.pins.length === 0 && <p className="text-xs text-muted-foreground italic">No films pinned yet.</p>}
                  {row.pins.map((pin) => (
                    <div key={pin.id} className="flex items-center gap-2 bg-secondary/30 rounded-lg px-2 py-1.5">
                      {pin.film?.thumbnail_url && (
                        <img src={pin.film.thumbnail_url} alt="" className="w-12 h-7 rounded object-cover" />
                      )}
                      <span className="text-sm text-foreground truncate flex-1">{pin.film?.title ?? "(deleted)"}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => movePin(row.id, pin.id, -1)}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => movePin(row.id, pin.id, 1)}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unpinFilm(pin.id)}>
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                {availableFilms.length > 0 && (
                  <Select value="" onValueChange={(v) => v && pinFilmToRow(row.id, v)}>
                    <SelectTrigger className="bg-secondary/50 border-border">
                      <SelectValue placeholder="+ Add a film to this row" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFilms.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>

        {/* Email Signups */}
        <h2 className="text-lg font-semibold text-foreground mb-4 mt-12 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> Email Signups ({emails.length})
        </h2>
        {emails.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No email signups yet.</p>
          </div>
        ) : (
          <div className="glass-panel-strong overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Email</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((signup) => (
                  <tr key={signup.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3 text-foreground">{signup.email}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(signup.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
