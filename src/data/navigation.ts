import { localeHref, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

/**
 * Central route configuration for the public site. Adding a page means adding
 * one entry here — the header, footer and mobile menu all read from it.
 */
export type NavKey = "home" | "about" | "projects" | "art" | "blog" | "contact";

export const navPaths: Record<NavKey, string> = {
  home: "/",
  about: "/about",
  projects: "/projects",
  art: "/art",
  blog: "/blog",
  contact: "/contact",
};

const NAV_ORDER: NavKey[] = ["home", "about", "projects", "art", "blog", "contact"];

export type NavItem = { key: NavKey; href: string; label: string };

export function siteNav(locale: Locale, nav: Pick<Dictionary["nav"], NavKey>): NavItem[] {
  return NAV_ORDER.map((key) => ({
    key,
    href: localeHref(locale, navPaths[key] === "/" ? "" : navPaths[key]),
    label: nav[key],
  }));
}

/** `path` is the locale-stripped pathname. */
export function matchesNav(key: NavKey, path: string): boolean {
  if (key === "home") return path === "/" || path === "";
  return path.startsWith(navPaths[key]);
}

export function navHref(locale: Locale, path: string): string {
  return localeHref(locale, path);
}
