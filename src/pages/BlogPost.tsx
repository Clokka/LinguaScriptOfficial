import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Seo, SITE_URL } from "@/components/Seo";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { BlogPost as Post, getPostBySlug, listPublishedPosts, readingTime } from "@/lib/blog";

const BlogPostPage = () => {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const found = await getPostBySlug(slug);
      const all = await listPublishedPosts();
      if (cancelled) return;
      setPost(found);
      setRelated(all.filter((p) => p.slug !== slug).slice(0, 3));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <MarketingLayout heading="Loading…" cta={null}>
        <p>Fetching the article.</p>
      </MarketingLayout>
    );
  }

  if (!post) {
    return (
      <>
        <Seo
          title="Article not found"
          description="This article does not exist or is not published yet."
          path={`/blog/${slug}`}
          noindex
        />
        <MarketingLayout heading="Article not found" cta={null}>
          <p>
            That article isn't here. <Link className="underline" to="/blog">Browse the blog</Link>.
          </p>
        </MarketingLayout>
      </>
    );
  }

  const published = post.published_at ?? post.created_at;

  return (
    <>
      <Seo
        title={post.meta_title || post.title}
        description={post.meta_description || post.excerpt || post.title}
        path={`/blog/${post.slug}`}
        type="article"
        image={post.cover_image_url ?? undefined}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.meta_description || post.excerpt || undefined,
            datePublished: published,
            dateModified: post.updated_at,
            author: { "@type": "Organization", name: post.author_name || "LinguaScript" },
            publisher: {
              "@type": "Organization",
              name: "LinguaScript",
              logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon-512x512.png` },
            },
            mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
            image: post.cover_image_url || undefined,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
              {
                "@type": "ListItem",
                position: 3,
                name: post.title,
                item: `${SITE_URL}/blog/${post.slug}`,
              },
            ],
          },
        ]}
      />
      <MarketingLayout
        eyebrow={`${new Date(published).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })} · ${readingTime(post.body)} min read`}
        heading={post.title}
        intro={post.excerpt}
        cta={{ label: "Try LinguaScript free", to: "/auth" }}
      >
        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt={post.title}
            loading="lazy"
            className="w-full rounded-2xl border border-border/60"
          />
        )}
        <div className="markdown-body space-y-5">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 className="pt-6 text-2xl font-bold text-foreground">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="pt-2 text-lg font-semibold text-foreground">{children}</h3>
              ),
              ul: ({ children }) => <ul className="list-disc space-y-2 pl-6">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal space-y-2 pl-6">{children}</ol>,
              a: ({ href, children }) =>
                href?.startsWith("/") ? (
                  <Link to={href} className="text-primary underline">
                    {children}
                  </Link>
                ) : (
                  <a href={href} className="text-primary underline" rel="noopener">
                    {children}
                  </a>
                ),
              table: ({ children }) => (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-border/60 px-3 py-2 text-left text-foreground">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-border/60 px-3 py-2">{children}</td>
              ),
            }}
          >
            {post.body}
          </ReactMarkdown>
        </div>

        {related.length > 0 && (
          <section className="pt-10">
            <h2 className="mb-4 text-xl font-bold text-foreground">Keep reading</h2>
            <ul className="space-y-2">
              {related.map((r) => (
                <li key={r.id}>
                  <Link to={`/blog/${r.slug}`} className="text-primary underline">
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </MarketingLayout>
    </>
  );
};

export default BlogPostPage;
