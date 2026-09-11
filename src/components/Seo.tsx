import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://linguascript.co.uk";
export const SITE_NAME = "LinguaScript";

export interface SeoProps {
  /** Page title. " — LinguaScript" is appended unless `rawTitle` is set. */
  title: string;
  description: string;
  /** Route path, e.g. "/dual-subtitles". Used for canonical + og:url. */
  path: string;
  /** Absolute https image URL for social previews. */
  image?: string;
  /** "website" (default) or "article". */
  type?: "website" | "article";
  /** Use the title verbatim instead of appending the brand suffix. */
  rawTitle?: boolean;
  noindex?: boolean;
  /** Extra JSON-LD blocks for this route. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Per-route head tags. Titles, descriptions, canonicals and og:* are set here
 * so each page is distinguishable in search results rather than inheriting the
 * sitewide defaults from index.html.
 */
export function Seo({
  title,
  description,
  path,
  image,
  type = "website",
  rawTitle = false,
  noindex = false,
  jsonLd,
}: SeoProps) {
  const fullTitle = rawTitle ? title : `${title} — ${SITE_NAME}`;
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,follow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {blocks.map((block, i) => (
        <script type="application/ld+json" key={i}>
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}

export default Seo;
