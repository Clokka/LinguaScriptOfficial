import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Seo, SITE_URL } from "@/components/Seo";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { BlogPost, listPublishedPosts, readingTime } from "@/lib/blog";

const Blog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPublishedPosts().then((p) => {
      setPosts(p);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <Seo
        title="Blog — language learning, backed by research"
        description="Articles on comprehensible input, spaced repetition, chunking and the science of learning a language faster by watching what you already enjoy."
        path="/blog"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "LinguaScript Blog",
          url: `${SITE_URL}/blog`,
        }}
      />
      <MarketingLayout
        eyebrow="LinguaScript blog"
        heading="How languages are actually learned"
        intro="Plain-English writing on the research behind immersion, comprehensible input and spaced repetition — and how we build it into LinguaScript."
        cta={{ label: "Try LinguaScript free", to: "/auth" }}
      >
        {loading && <p>Loading articles…</p>}
        {!loading && posts.length === 0 && (
          <p>No articles published yet. Check back shortly.</p>
        )}
        <ul className="not-prose space-y-4">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                to={`/blog/${post.slug}`}
                className="block rounded-2xl border border-border/60 bg-secondary/20 p-6 transition-colors hover:border-primary/50"
              >
                <h2 className="text-xl font-bold text-foreground">{post.title}</h2>
                {post.excerpt && <p className="mt-2 text-muted-foreground">{post.excerpt}</p>}
                <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : ""}
                  {" · "}
                  {readingTime(post.body)} min read
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </MarketingLayout>
    </>
  );
};

export default Blog;
