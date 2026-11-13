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
}: {
  locale: Locale;
  siteName: string;
  description?: string | null;
  person?: PersonInput | null;
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
}: {
  canonicalUrl: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  type?: "CreativeWork" | "VisualArtwork";
  medium?: string | null;
}) {
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
    author: { "@type": "Person", name: authorName },
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
