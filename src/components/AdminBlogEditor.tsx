import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BlogPost, deletePost, listAllPosts, savePost, slugify } from "@/lib/blog";
import { FileText, Plus, Trash2, Eye, EyeOff } from "lucide-react";

const emptyPost = (): Partial<BlogPost> => ({
  slug: "",
  title: "",
  excerpt: "",
  body: "",
  meta_title: "",
  meta_description: "",
  tags: [],
  status: "draft",
  cover_image_url: "",
  author_name: "LinguaScript",
});

/** Character counter that turns amber outside the recommended SEO range. */
const Counter = ({ value, min, max }: { value: string; min: number; max: number }) => {
  const n = value.length;
  const ok = n >= min && n <= max;
  return (
    <span className={ok ? "text-brand-green" : "text-orange-400"}>
      {n}/{max}
    </span>
  );
};

export function AdminBlogEditor() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [draft, setDraft] = useState<Partial<BlogPost>>(emptyPost());
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const refresh = () => listAllPosts().then(setPosts);
  useEffect(() => {
    refresh();
  }, []);

  const editing = Boolean(draft.id);
  const slugPreview = useMemo(
    () => draft.slug || slugify(draft.title ?? ""),
    [draft.slug, draft.title],
  );

  const load = (post: BlogPost) => {
    setDraft(post);
    setTagsInput((post.tags ?? []).join(", "));
    setShowPreview(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setDraft(emptyPost());
    setTagsInput("");
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!draft.title?.trim()) {
      toast({ title: "A title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await savePost({
      ...draft,
      title: draft.title.trim(),
      slug: slugPreview,
      status,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    } as BlogPost);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error, variant: "destructive" });
      return;
    }
    toast({
      title: status === "published" ? "Published" : "Draft saved",
      description: `/blog/${slugPreview}`,
    });
    reset();
    refresh();
  };

  const handleDelete = async (post: BlogPost) => {
    const error = await deletePost(post.id);
    if (error) {
      toast({ title: "Could not delete", description: error, variant: "destructive" });
      return;
    }
    if (draft.id === post.id) reset();
    refresh();
  };

  return (
    <section className="glass-panel-strong mb-8 space-y-5 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <FileText className="h-5 w-5 text-primary" /> Blog
      </h2>
      <p className="text-sm text-muted-foreground">
        Write articles in markdown. Published posts appear at <code>/blog</code> and are picked up
        by the sitemap on the next build.
      </p>

      <div className="space-y-3">
        <Input
          placeholder="Article title"
          value={draft.title ?? ""}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="border-border bg-secondary/50"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>URL:</span>
          <code>/blog/{slugPreview || "…"}</code>
          <Input
            placeholder="custom-slug (optional)"
            value={draft.slug ?? ""}
            onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
            className="h-7 max-w-xs border-border bg-secondary/50 text-xs"
          />
        </div>

        <Textarea
          placeholder="Excerpt — one or two sentences shown on the blog index"
          value={draft.excerpt ?? ""}
          onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
          className="min-h-[70px] border-border bg-secondary/50"
        />

        <Textarea
          placeholder="Article body (markdown: ## headings, **bold**, - lists, [links](/dual-subtitles), tables)"
          value={draft.body ?? ""}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          className="min-h-[320px] border-border bg-secondary/50 font-mono text-sm"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>SEO title (defaults to article title)</span>
              <Counter value={draft.meta_title ?? ""} min={0} max={60} />
            </label>
            <Input
              value={draft.meta_title ?? ""}
              onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })}
              className="border-border bg-secondary/50"
            />
          </div>
          <div>
            <label className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Meta description</span>
              <Counter value={draft.meta_description ?? ""} min={50} max={160} />
            </label>
            <Input
              value={draft.meta_description ?? ""}
              onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })}
              className="border-border bg-secondary/50"
            />
          </div>
          <Input
            placeholder="Cover image URL (optional)"
            value={draft.cover_image_url ?? ""}
            onChange={(e) => setDraft({ ...draft, cover_image_url: e.target.value })}
            className="border-border bg-secondary/50"
          />
          <Input
            placeholder="Tags, comma separated"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="border-border bg-secondary/50"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleSave("published")} disabled={saving} className="gap-2">
            <Plus className="h-4 w-4" /> {editing ? "Save & publish" : "Publish"}
          </Button>
          <Button variant="secondary" onClick={() => handleSave("draft")} disabled={saving}>
            Save draft
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowPreview((v) => !v)}
            className="gap-2"
            aria-label={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? "Hide preview" : "Preview"}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={reset}>
              New article
            </Button>
          )}
        </div>

        {showPreview && (
          <div className="rounded-xl border border-border/60 bg-background/60 p-5 leading-relaxed text-muted-foreground">
            <h3 className="mb-3 text-2xl font-bold text-foreground">{draft.title}</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.body ?? ""}</ReactMarkdown>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">All articles</h3>
        <ul className="space-y-2">
          {posts.length === 0 && (
            <li className="text-sm text-muted-foreground">Nothing written yet.</li>
          )}
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2"
            >
              <button onClick={() => load(post)} className="text-left">
                <span className="text-sm font-medium text-foreground">{post.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {post.status === "published" ? "published" : "draft"} · /blog/{post.slug}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${post.title}`}
                onClick={() => handleDelete(post)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default AdminBlogEditor;
