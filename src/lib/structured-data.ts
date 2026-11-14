import { localeHtmlLang, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/utils";

type PersonInput = {
  name: string;
  jobTitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  location?: string | null;
  aboutUrl: string;
  sameAs?: string[];
};

export type BreadcrumbItem = { name: string; href: string };

/** WebSite + Person graph for the public shell. No email or admin data. */
export function buildSiteGraph({
  locale,
  siteName,
  description,
  person,
  logoUrl,
  searchUrlTemplate,
}: {
  locale: Locale;
  siteName: string;
  description?: string | null;
  person?: PersonInput | null;
  /** Publisher/WebSite logo URL; callers pass the /icon.png fallback when unset. */
  logoUrl?: string | null;
  /** Absolute SearchAction target, e.g. `/vi/blog?q={search_term_string}`. */
  searchUrlTemplate?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl("/")}#website`,
        name: siteName,
        url: absoluteUrl("/"),
        inLanguage: localeHtmlLang[locale],
        ...(description ? { description } : {}),
        ...(logoUrl ? { logo: { "@type": "ImageObject", url: absoluteUrl(logoUrl) } } : {}),
        ...(searchUrlTemplate
          ? {
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: searchUrlTemplate },
                "query-input": "required name=search_term_string",
              },
            }
          : {}),
      },
      ...(person
        ? [
            {
              "@type": "Person",
              "@id": `${absoluteUrl(person.aboutUrl)}#person`,
              name: person.name,
              url: absoluteUrl(person.aboutUrl),
              ...(person.jobTitle ? { jobTitle: person.jobTitle } : {}),
              ...(person.description ? { description: person.description } : {}),
              ...(person.imageUrl ? { image: absoluteUrl(person.imageUrl) } : {}),
              ...(person.location ? { address: person.location } : {}),
              ...(person.sameAs?.length ? { sameAs: person.sameAs } : {}),
            },
          ]
        : []),
    ],
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };
}

/** Case-study / gallery detail metadata for non-article content. */
export function buildCreativeWorkSchema({
  canonicalUrl,
  name,
  description,
  imageUrl,
  datePublished,
  dateModified,
  type = "CreativeWork",
  medium,
  technologies,
  keywords,
}: {
  canonicalUrl: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  type?: "CreativeWork" | "VisualArtwork";
  medium?: string | null;
  /** Project stack; merged into `keywords` (no schema.org "technologies"). */
  technologies?: string[];
  keywords?: string[];
}) {
  const allKeywords = Array.from(new Set([...(technologies ?? []), ...(keywords ?? [])].map((item) => item.trim()).filter(Boolean)));
  return {
    "@type": type,
    "@id": `${canonicalUrl}#work`,
    name,
    description,
    url: canonicalUrl,
    ...(imageUrl ? { image: [absoluteUrl(imageUrl)] } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(type === "VisualArtwork" && medium ? { artMedium: medium } : {}),
    ...(allKeywords.length ? { keywords: allKeywords.join(", ") } : {}),
  };
}

/** Ordered list of named things (articles, artworks, projects) with absolute URLs. */
export function buildItemListSchema({
  id,
  items,
}: {
  id?: string;
  items: { name: string; url: string }[];
}) {
  return {
    "@type": "ItemList",
    ...(id ? { "@id": id } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  };
}

/** Blog node for a list page; pair with buildItemListSchema for its entries. */
export function buildBlogSchema({ blogUrl, name, description }: { blogUrl: string; name: string; description?: string }) {
  return {
    "@type": "Blog",
    "@id": `${absoluteUrl(blogUrl)}#blog`,
    url: absoluteUrl(blogUrl),
    name,
    ...(description ? { description } : {}),
  };
}

/** CollectionPage node for a project/art list page; pair with buildItemListSchema. */
export function buildCollectionPageSchema({
  pageUrl,
  name,
  description,
}: {
  pageUrl: string;
  name: string;
  description?: string;
}) {
  return {
    "@type": "CollectionPage",
    "@id": absoluteUrl(pageUrl),
    url: absoluteUrl(pageUrl),
    name,
    ...(description ? { description } : {}),
  };
}

export type ArticleSchemaInput = {
  locale: Locale;
  siteName: string;
  siteLogoUrl?: string | null;
  canonicalUrl: string;
  headline: string;
  description: string;
  imageUrl?: string | null;
  datePublished?: string | null;
  dateModified: string;
  authorName: string;
  /** Locale-less about URL ("/{locale}/about"); links the author to the layout Person @id. */
  authorAboutUrl?: string | null;
  categoryName?: string | null;
  keywords?: string[];
  wordCount?: number;
  blogUrl: string;
};

/**
 * BlogPosting with only fields the CMS actually stores. Reading time is a UI
 * hint, not a schema.org property, so it is deliberately absent.
 */
export function buildArticleSchema({
  locale,
  siteName,
  siteLogoUrl,
  canonicalUrl,
  headline,
  description,
  imageUrl,
  datePublished,
  dateModified,
  authorName,
  authorAboutUrl,
  categoryName,
  keywords,
  wordCount,
  blogUrl,
}: ArticleSchemaInput) {
  return {
    "@type": "BlogPosting",
    "@id": `${canonicalUrl}#article`,
    headline,
    description,
    url: canonicalUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    inLanguage: localeHtmlLang[locale],
    ...(imageUrl ? { image: [absoluteUrl(imageUrl)] } : {}),
    ...(datePublished ? { datePublished } : {}),
    dateModified,
    author: authorAboutUrl
      ? {
          "@type": "Person",
          "@id": `${absoluteUrl(authorAboutUrl)}#person`,
          name: authorName,
          url: absoluteUrl(authorAboutUrl),
        }
      : { "@type": "Person", name: authorName },
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: absoluteUrl("/"),
      ...(siteLogoUrl ? { logo: { "@type": "ImageObject", url: absoluteUrl(siteLogoUrl) } } : {}),
    },
    ...(categoryName ? { articleSection: categoryName } : {}),
    ...(keywords?.length ? { keywords: keywords.join(", ") } : {}),
    ...(wordCount ? { wordCount } : {}),
    isPartOf: { "@type": "Blog", "@id": `${absoluteUrl(blogUrl)}#blog`, url: absoluteUrl(blogUrl) },
  };
}
