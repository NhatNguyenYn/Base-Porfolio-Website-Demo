import type { Metadata } from "next";
import { alternateLocale, defaultLocale, locales, localeOgLocale, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/utils";

export const OG_IMAGE_PATH = "/og-default.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export type SocialImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

function mediaUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : absoluteUrl(url);
}

/** A CMS cover or avatar, with real dimensions when the media record has them. */
export function socialImage(
  url: string,
  alt: string,
  width?: number | null,
  height?: number | null,
): SocialImage {
  return {
    url: mediaUrl(url),
    alt: alt.trim() || "Portfolio",
    ...(width && height ? { width, height } : {}),
  };
}

/** Shared fallback used when a page has no cover/avatar of its own. */
export function defaultSocialImage(siteName: string): SocialImage {
  return {
    url: absoluteUrl(OG_IMAGE_PATH),
    alt: `${siteName} — design, writing and selected work`,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
  };
}

/**
 * Social crawlers do not reliably render SVG. When a CMS cover is an SVG (for
 * example the bundled demo placeholders), use the branded PNG fallback rather
 * than advertising an image Facebook/LinkedIn may refuse to show.
 */
export function safeSocialImage(image: SocialImage | null | undefined, siteName: string): SocialImage {
  if (!image || /\.svg(?:[?#]|$)/i.test(image.url)) return defaultSocialImage(siteName);
  return image;
}

/**
 * Builds the `alternates.languages` map for a page, including only locales that
 * actually have a translation. A page that exists in Vietnamese but not English
 * must not advertise an English hreflang — that would point crawlers at a URL
 * whose content is intentionally not shown.
 */
export function languageAlternates(path: string, available: Locale[]): Record<string, string> {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const present = new Set(available);
  const languages: Record<string, string> = {};

  for (const locale of locales) {
    if (present.has(locale)) languages[locale] = `/${locale}${clean}`;
  }

  const fallback = present.has(defaultLocale) ? defaultLocale : locales.find((locale) => present.has(locale));
  if (fallback) languages["x-default"] = `/${fallback}${clean}`;

  return languages;
}

/** Canonical URL for a localized path. */
export function canonicalPath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean === "/" ? "" : clean}`;
}

export type PageMetadataInput = {
  locale: Locale;
  /** Locale-less path, e.g. `/blog/my-article`. */
  path: string;
  /** Page title without the site-name suffix (the layout adds it). */
  title: string;
  description: string;
  siteName: string;
  availableLocales?: Locale[];
  type?: "website" | "article";
  image?: SocialImage | null;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  absoluteTitle?: boolean;
  noindex?: boolean;
};

/**
 * One place for canonical, hreflang, Open Graph and Twitter metadata. Keeping
 * these together prevents a page from shipping a canonical in one language and
 * an OG URL in another, or from forgetting the fallback image.
 */
export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  siteName,
  availableLocales,
  type = "website",
  image,
  publishedTime,
  modifiedTime,
  authors,
  absoluteTitle = false,
  noindex = false,
}: PageMetadataInput): Metadata {
  const canonical = absoluteUrl(canonicalPath(locale, path));
  const social = safeSocialImage(image, siteName);
  const languages = Object.fromEntries(
    Object.entries(languageAlternates(path, availableLocales ?? [...locales])).map(([key, value]) => [
      key,
      absoluteUrl(value),
    ]),
  );

  const openGraph: Record<string, unknown> = {
    type,
    title,
    description,
    url: canonical,
    siteName,
    locale: localeOgLocale[locale],
    alternateLocale: localeOgLocale[alternateLocale(locale)],
    images: [social],
    ...(type === "article"
      ? {
          publishedTime,
          modifiedTime,
          authors,
        }
      : {}),
  };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: openGraph as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: social.url, alt: social.alt }],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
