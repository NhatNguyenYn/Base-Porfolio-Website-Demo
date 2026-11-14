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

/** True when a URL points at an SVG (query strings and fragments ignored). */
export function isSvgUrl(url: string): boolean {
  return /\.svg(?:[?#]|$)/i.test(url);
}

/**
 * Builds the `alternates.languages` map for a page, including only locales that
 * actually have a translation. A page that exists in Vietnamese but not English
 * must not advertise an English hreflang — that would point crawlers at a URL
 * whose content is intentionally not shown.
 */
export function languageAlternates(path: string, available: Locale[]): Record<string, string> {
  const clean = path.startsWith("/") ? path : `/${path}`;
  // Mirror canonicalPath: the home path "/" has no trailing segment, so its
  // alternates must not gain a trailing slash either — in server mode the
  // home canonical is /vi, not /vi/, and an hreflang pointing at a redirect
  // is an error. The Pages-export slash is re-added downstream by
  // canonicalAbsoluteUrl, so export output is unchanged.
  const suffix = clean === "/" ? "" : clean;
  const present = new Set(available);
  const languages: Record<string, string> = {};

  for (const locale of locales) {
    if (present.has(locale)) languages[locale] = `/${locale}${suffix}`;
  }

  const fallback = present.has(defaultLocale) ? defaultLocale : locales.find((locale) => present.has(locale));
  if (fallback) languages["x-default"] = `/${fallback}${suffix}`;

  return languages;
}

/** Canonical URL for a localized path. */
export function canonicalPath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean === "/" ? "" : clean}`;
}

/**
 * Trailing-slash handling for PAGE URLs on the GitHub Pages static export
 * (PAGES_EXPORT=1, trailingSlash:true in next.config.ts): the served demo URL
 * ends in "/", so canonicals, hreflang and sitemap URLs must too, or crawlers
 * see a redirect on every canonical. Deliberately NOT applied to absoluteUrl
 * globally — images, API URLs and media URLs must never gain a trailing slash.
 */
export function withPagesTrailingSlash(url: string): string {
  if (process.env.PAGES_EXPORT !== "1" || url.endsWith("/")) return url;
  const cut = url.search(/[?#]/);
  if (cut === -1) return `${url}/`;
  return `${url.slice(0, cut)}/${url.slice(cut)}`;
}

/** Canonical URL for a localized page path (trailing slash on Pages export). */
export function canonicalUrl(locale: Locale, path: string): string {
  return withPagesTrailingSlash(absoluteUrl(canonicalPath(locale, path)));
}

/** Apply the Pages-export trailing slash to an already-absolute page URL. */
export function canonicalAbsoluteUrl(url: string): string {
  return withPagesTrailingSlash(url);
}

export type SocialLinkLike = { platform: string; url: string };

/**
 * X handle mechanism only: derive "@handle" from a stored social link whose
 * platform is X/Twitter or whose URL is on x.com / twitter.com. Returns null
 * when no such link exists — a handle is never invented.
 */
export function xHandleFromSocials(socials: SocialLinkLike[] | null | undefined): string | null {
  if (!socials) return null;
  for (const link of socials) {
    const match = /^(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i.exec(
      link.url.trim(),
    );
    if (match) return `@${match[1]}`;
    // A platform labelled X/Twitter whose URL is not an x.com profile link
    // carries no derivable handle — never guess one from the label alone.
  }
  return null;
}

/**
 * Prev/next pagination URLs for a list page, as absolute canonical-style URLs.
 * Params are re-emitted in a fixed order so the same view always has one URL.
 */
export function paginationLinks({
  locale,
  path,
  params,
  page,
  pages,
}: {
  locale: Locale;
  path: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
}): { prev?: string; next?: string } {
  const build = (targetPage: number): string => {
    const allParams: Record<string, string | undefined> = {
      ...params,
      page: targetPage > 1 ? String(targetPage) : undefined,
    };
    const search = new URLSearchParams();
    for (const key of Object.keys(allParams).sort()) {
      const value = allParams[key];
      if (value) search.set(key, value);
    }
    const query = search.toString();
    return canonicalAbsoluteUrl(`${absoluteUrl(canonicalPath(locale, path))}${query ? `?${query}` : ""}`);
  };
  return {
    ...(page > 1 ? { prev: build(page - 1) } : {}),
    ...(page < pages ? { next: build(page + 1) } : {}),
  };
}

/**
 * Deterministic query string for a list view's self-canonical: the same
 * filters always produce the same canonical, in the same parameter order.
 * `page=1` is omitted (page 1 is the bare list URL).
 */
export function listCanonicalQuery(params: Record<string, string | undefined>): string | undefined {
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (key === "page" && (!value || value === "1")) continue;
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query || undefined;
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
  /** Explicit robots directive; overrides the `noindex` shorthand when given. */
  robots?: Metadata["robots"];
  /** Raw query string (without "?") appended to the self-canonical, e.g. "page=2". */
  canonicalQuery?: string;
  /** X handle ("@handle") for twitter:site/creator; omitted when absent. */
  twitterSite?: string | null;
  twitterCreator?: string | null;
  /** Settings favicon URL; falls back to the bundled /icon.png when absent. */
  faviconUrl?: string | null;
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
  robots,
  canonicalQuery,
  twitterSite,
  twitterCreator,
  faviconUrl,
}: PageMetadataInput): Metadata {
  const canonical = canonicalUrl(locale, path) + (canonicalQuery ? `?${canonicalQuery}` : "");
  const social = safeSocialImage(image, siteName);
  const languages = Object.fromEntries(
    Object.entries(languageAlternates(path, availableLocales ?? [...locales])).map(([key, value]) => [
      key,
      canonicalAbsoluteUrl(absoluteUrl(value)),
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

  const twitterImages: { url: string; alt: string; width?: number; height?: number } = {
    url: social.url,
    alt: social.alt,
    ...(social.width && social.height ? { width: social.width, height: social.height } : {}),
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
      images: [twitterImages],
      ...(twitterSite ? { site: twitterSite } : {}),
      ...(twitterCreator ? { creator: twitterCreator } : {}),
    },
    icons: { icon: faviconUrl || "/icon.png" },
    ...(robots
      ? { robots }
      : noindex
        ? { robots: { index: false, follow: false } }
        : {}),
  };
}
