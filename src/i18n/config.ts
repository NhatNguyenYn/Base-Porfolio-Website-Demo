export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "vi";

export const localeNames: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

export const localeShort: Record<Locale, string> = {
  vi: "VI",
  en: "EN",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function alternateLocale(locale: Locale): Locale {
  return locale === "vi" ? "en" : "vi";
}

/** Prefix a path with the locale segment. `localeHref("vi", "/about")` → "/vi/about". */
export function localeHref(locale: Locale, path = ""): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

/** Strip the leading locale segment from a pathname, if present. */
export function stripLocale(pathname: string): { locale: Locale | null; path: string } {
  const match = /^\/(vi|en)(?=\/|$)/.exec(pathname);
  if (!match) return { locale: null, path: pathname || "/" };
  const rest = pathname.slice(match[0].length);
  return { locale: match[1] as Locale, path: rest || "/" };
}

export const localeHtmlLang: Record<Locale, string> = {
  vi: "vi-VN",
  en: "en",
};

export const localeOgLocale: Record<Locale, string> = {
  vi: "vi_VN",
  en: "en_US",
};
