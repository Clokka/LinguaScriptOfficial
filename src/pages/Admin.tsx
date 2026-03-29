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
import { ArrowLeft, Plus, Trash2, Film, Loader2, Upload, FileText, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface FilmRow {
  id: string;
  title: string;
  url: string;
  language: string | null;
  thumbnail_url: string | null;
  created_at: string;
  subtitle_count?: number;
}

const Admin = () => {
  const [films, setFilms] = useState<FilmRow[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("es");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [uploadingSubsFor, setUploadingSubsFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingFileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchFilms();
  }, []);

  const fetchFilms = async () => {
    const { data } = await supabase.from("films").select("*").order("created_at", { ascending: false });
    if (data) {
      // Get subtitle counts
      const filmsWithCounts = await Promise.all(
        data.map(async (film) => {
          const { count } = await supabase
            .from("subtitles")
            .select("*", { count: "exact", head: true })
            .eq("film_id", film.id);
          return { ...film, subtitle_count: count ?? 0 };
        })
      );
      setFilms(filmsWithCounts);
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

    const { data, error } = await supabase.from("films").insert({
      title,
      url,
      language,
      thumbnail_url: thumb,
    }).select().single();

    if (error) {
      toast({ title: "Error adding film", description: error.message, variant: "destructive" });
    } else {
      // Upload SRT if provided
      if (srtFile && data) {
        await parseSrtAndUpload(data.id, srtFile);
      }
      toast({ title: "Film added!" });
      setTitle("");
      setUrl("");
      setThumbnailUrl("");
      setSrtFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchFilms();
    }
    setAdding(false);
  };

  const handleUploadSubsForExisting = async (filmId: string, file: File) => {
    setUploadingSubsFor(filmId);
    await parseSrtAndUpload(filmId, file);
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
        <p className="text-muted-foreground mb-8">Add films and upload subtitle tracks (.srt files).</p>

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

          {/* SRT Upload */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" /> Subtitle File (.srt) — optional
            </label>
            <div className="flex items-center gap-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".srt"
                onChange={(e) => setSrtFile(e.target.files?.[0] ?? null)}
                className="bg-secondary/50 border-border"
              />
              {srtFile && (
                <span className="text-xs text-primary flex items-center gap-1 whitespace-nowrap">
                  <Check className="w-3 h-3" /> {srtFile.name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload an .srt file for accurate subtitles. If not provided, we'll try to fetch from YouTube.
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
                  <Button variant="glass" size="icon" onClick={() => deleteFilm(film.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                {/* Subtitle status + upload */}
                <div className="flex items-center justify-between pl-20">
                  <span className="text-xs text-muted-foreground">
                    {(film.subtitle_count ?? 0) > 0 ? (
                      <span className="text-primary">✓ {film.subtitle_count} subtitles loaded</span>
                    ) : (
                      "No subtitles uploaded"
                    )}
                  </span>
                  <div>
                    <input
                      ref={existingFileInputRef}
                      type="file"
                      accept=".srt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadSubsForExisting(film.id, file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="glass"
                      size="sm"
                      className="gap-1 text-xs"
                      disabled={uploadingSubsFor === film.id}
                      onClick={() => {
                        existingFileInputRef.current?.click();
                        // Store film ID for the handler
                        if (existingFileInputRef.current) {
                          existingFileInputRef.current.dataset.filmId = film.id;
                        }
                      }}
                    >
                      {uploadingSubsFor === film.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      {(film.subtitle_count ?? 0) > 0 ? "Replace SRT" : "Upload SRT"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
