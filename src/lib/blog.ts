import { supabase } from "@/integrations/supabase/client";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[];
  status: "draft" | "published";
  published_at: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

const table = () => (supabase as any).from("blog_posts");

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);

/** Rough reading time in minutes, at 220 words per minute. */
export const readingTime = (body: string) =>
  Math.max(1, Math.round(body.trim().split(/\s+/).length / 220));

export async function listPublishedPosts(): Promise<BlogPost[]> {
  const { data, error } = await table()
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) {
    console.error("listPublishedPosts", error);
    return [];
  }
  return (data ?? []) as BlogPost[];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data } = await table().select("*").eq("slug", slug).maybeSingle();
  return (data as BlogPost) ?? null;
}

/** Admin view: every post, drafts included (RLS gates this to admins). */
export async function listAllPosts(): Promise<BlogPost[]> {
  const { data, error } = await table().select("*").order("updated_at", { ascending: false });
  if (error) {
    console.error("listAllPosts", error);
    return [];
  }
  return (data ?? []) as BlogPost[];
}

export async function savePost(
  post: Partial<BlogPost> & { slug: string; title: string },
): Promise<{ error?: string; id?: string }> {
  const payload = {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? null,
    body: post.body ?? "",
    cover_image_url: post.cover_image_url || null,
    meta_title: post.meta_title || null,
    meta_description: post.meta_description || null,
    tags: post.tags ?? [],
    status: post.status ?? "draft",
    published_at:
      post.status === "published" ? post.published_at ?? new Date().toISOString() : null,
    author_name: post.author_name || null,
  };

  if (post.id) {
    const { error } = await table().update(payload).eq("id", post.id);
    return error ? { error: error.message } : { id: post.id };
  }
  const { data, error } = await table().insert(payload).select("id").single();
  return error ? { error: error.message } : { id: (data as { id: string }).id };
}

export async function deletePost(id: string) {
  const { error } = await table().delete().eq("id", id);
  return error?.message;
}
