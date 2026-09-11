// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
// Static marketing routes are listed here; published blog posts are pulled from
// the database at build time so new articles enter the sitemap on the next deploy.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://linguascript.co.uk";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/the-chameleon-method", changefreq: "monthly", priority: "0.9" },
  { path: "/dual-subtitles", changefreq: "monthly", priority: "0.9" },
  { path: "/dual-subtitles/netflix", changefreq: "monthly", priority: "0.8" },
  { path: "/dual-subtitles/youtube", changefreq: "monthly", priority: "0.8" },
  { path: "/anki-alternative", changefreq: "monthly", priority: "0.8" },
  { path: "/vs/language-reactor", changefreq: "monthly", priority: "0.8" },
  { path: "/chrome-extension", changefreq: "monthly", priority: "0.8" },
  { path: "/language-learning-psychology", changefreq: "monthly", priority: "0.8" },
  { path: "/for-schools", changefreq: "monthly", priority: "0.8" },
  { path: "/polyglot", changefreq: "monthly", priority: "0.7" },
  { path: "/family", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/story", changefreq: "yearly", priority: "0.6" },
  { path: "/pricing", changefreq: "monthly", priority: "0.7" },
  { path: "/linguascripts", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

async function fetchBlogEntries(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/blog_posts?select=slug,updated_at&status=eq.published&order=published_at.desc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as { slug: string; updated_at: string }[];
    return rows.map((row) => ({
      path: `/blog/${row.slug}`,
      // Authoritative per-post timestamp from the database.
      lastmod: row.updated_at?.slice(0, 10),
      changefreq: "monthly" as const,
      priority: "0.7",
    }));
  } catch {
    return [];
  }
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

const entries = [...staticEntries, ...(await fetchBlogEntries())];
writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
