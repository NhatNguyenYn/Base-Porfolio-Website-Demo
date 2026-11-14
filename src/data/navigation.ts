import { localeHref, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

/**
 * Central route configuration for the public site. Adding a page means adding
 * one entry here — the header, footer and mobile menu all read from it.
 */
export type NavKey = "home" | "about" | "projects" | "art" | "blog" | "booking" | "contact";

export const navPaths: Record<NavKey, string> = {
  home: "/",
  about: "/about",
  projects: "/projects",
  art: "/art",
  blog: "/blog",
  booking: "/dat-lich-khao-sat",
  contact: "/contact",
};

const NAV_ORDER: NavKey[] = ["home", "about", "projects", "art", "blog", "booking", "contact"];

/**
 * Which navigation entries a visitor can see. Labels live in the dictionaries
 * and paths in `navPaths`, so this map never depends on language or URL and is
 * safe to move to the database later (an admin Navigation Management screen can
 * load the same shape without touching the components).
 *
 * Hidden entries keep their page, data, API and CMS screen; only the menu link
 * is omitted. Direct visits and `matchesNav` are unaffected.
 */
export type NavVisibility = Record<NavKey, boolean>;

export const navVisibility: NavVisibility = {
  home: true,
  about: true,
  projects: false,
  art: true,
  blog: true,
  booking: true,
  contact: true,
};

export type NavItem = { key: NavKey; href: string; label: string };

/** Visible keys in menu order, derived from the single visibility map. */
export function visibleNavKeys(visibility: NavVisibility = navVisibility): NavKey[] {
  return NAV_ORDER.filter((key) => visibility[key]);
}

/**
 * Header, mobile drawer and footer all call this function, so a hidden entry
 * disappears everywhere at once and the order stays shared.
 */
export function siteNav(
  locale: Locale,
  nav: Pick<Dictionary["nav"], NavKey>,
  visibility: NavVisibility = navVisibility,
): NavItem[] {
  return visibleNavKeys(visibility).map((key) => ({
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
