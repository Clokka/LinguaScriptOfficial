import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Film, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface FilmRow {
  id: string;
  title: string;
  url: string;
  language: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

const Admin = () => {
  const [films, setFilms] = useState<FilmRow[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("es");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchFilms();
  }, []);

  const fetchFilms = async () => {
    const { data } = await supabase.from("films").select("*").order("created_at", { ascending: false });
    setFilms(data ?? []);
    setLoading(false);
  };

  const addFilm = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const { error } = await supabase.from("films").insert({
      title,
      url,
      language,
      thumbnail_url: thumbnailUrl || null,
    });
    if (error) {
      toast({ title: "Error adding film", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Film added!" });
      setTitle("");
      setUrl("");
      setThumbnailUrl("");
      fetchFilms();
    }
    setAdding(false);
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
        <p className="text-muted-foreground mb-8">Add films for users to watch and learn from.</p>

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
            placeholder="Video URL (embed or direct link)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="bg-secondary/50 border-border"
          />
          <Input
            placeholder="Thumbnail URL (optional)"
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
              <div key={film.id} className="glass-panel p-4 flex items-center justify-between gap-4">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
