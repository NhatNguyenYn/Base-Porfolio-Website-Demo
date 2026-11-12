import { defaultLocale, locales, type Locale } from "@/i18n/config";

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
