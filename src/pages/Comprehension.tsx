import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ComprehensionPanel } from "@/components/ComprehensionPanel";
import { ActiveLanguageBadge } from "@/components/ActiveLanguageBadge";

function extractVideoId(input: string): string | null {
  const m = input.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([^&?\s/]+)/,
  );
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{8,15}$/.test(input.trim())) return input.trim();
  return null;
}

export default function Comprehension() {
  const [url, setUrl] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  function analyze(e: React.FormEvent) {
    e.preventDefault();
    const id = extractVideoId(url);
    if (!id) {
      setInputError("Paste a valid YouTube URL (or 11-char video ID).");
      return;
    }
    setInputError(null);
    setActiveVideoId(id);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/browse"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <ActiveLanguageBadge />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Comprehension Engine</h1>
          </div>
          <p className="text-muted-foreground">
            Paste any YouTube video. We map every word against your vocabulary and show your
            real comprehension — no AI guessing.
          </p>
        </div>

        <Card className="p-4">
          <form onSubmit={analyze} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" className="gap-2">
              <Play className="h-4 w-4" /> Analyze
            </Button>
          </form>
          {inputError && (
            <p className="text-xs text-destructive mt-2">{inputError}</p>
          )}
        </Card>

        {activeVideoId && (
          <div>
            <div className="aspect-video rounded-xl overflow-hidden border bg-black mb-4">
              <iframe
                src={`https://www.youtube.com/embed/${activeVideoId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <ComprehensionPanel videoId={activeVideoId} />
          </div>
        )}
      </main>
    </div>
  );
}
