"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { localeHref, stripLocale, type Locale } from "@/i18n/config";
import { matchesNav, siteNav } from "@/data/navigation";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { SocialLinks, type SocialLinkItem } from "./social-links";

export type HeaderProps = {
  locale: Locale;
  siteName: string;
  nav: { home: string; about: string; projects: string; art: string; blog: string; contact: string; menu: string; close: string };
  themeLabels: { theme: string; light: string; dark: string };
  languageLabel: string;
  socials: SocialLinkItem[];
  email: string;
};

export function SiteHeader({ locale, siteName, nav, themeLabels, languageLabel, socials, email }: HeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  // The mobile panel is portalled to <body>: the header carries a
  // backdrop-filter when scrolled, which would otherwise become the
  // containing block for its fixed positioning and collapse it.
  useEffect(() => setMounted(true), []);

  const { path } = stripLocale(pathname || "/");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = siteNav(locale, nav);
  // The primary CTA repeats Contact; keep it in sync with the visibility map
  // so hiding Contact later does not leave a stray link behind.
  const contactVisible = items.some((item) => item.key === "contact");

  const monogram = siteName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "border-b border-line bg-background/90 backdrop-blur-xl"
          : "border-b border-transparent bg-background/0",
      )}
    >
      <div className="container-page flex h-[70px] items-center justify-between gap-6">
        <Link href={localeHref(locale)} className="group flex items-center gap-3">
          <span className="relative grid h-8 w-8 place-items-center border border-line-strong text-[11px] font-semibold tracking-tight transition-colors group-hover:border-ink">
            {monogram || "PS"}
            <span className="absolute -right-[3px] -top-[3px] h-1.5 w-1.5 bg-ruby-bright" aria-hidden="true" />
          </span>
          <span className="hidden text-[13px] font-medium tracking-[0.01em] sm:block">{siteName}</span>
          <span className="sr-only sm:hidden">{siteName}</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label={nav.menu}>
          {items.map((item) => {
            const active = matchesNav(item.key, path);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "underline-sweep text-[13px] transition-colors",
                  active ? "text-accent" : "text-muted hover:text-ink",
                )}
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher locale={locale} label={languageLabel} />
          </div>
          <ThemeSwitcher labels={themeLabels} />
          {contactVisible && (
            <Link href={localeHref(locale, "/contact")} className="btn btn-primary btn-sm ml-1 hidden lg:inline-flex">
              {nav.contact}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? nav.close : nav.menu}
            className="ml-1 grid h-9 w-9 place-items-center rounded-full border border-line text-ink transition-colors hover:border-line-strong lg:hidden"
          >
            {open ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M5 5l14 14M19 5 5 19" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M3 7h18M3 12h18M3 17h12" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && mounted && createPortal(
        <div className="mobile-panel fixed inset-x-0 top-[70px] bottom-0 z-40 overflow-y-auto border-t border-line bg-background lg:hidden">
          <div className="container-page flex min-h-full flex-col justify-between py-8">
            <nav className="flex flex-col" aria-label={nav.menu}>
              {items.map((item, index) => {
                const active = matchesNav(item.key, path);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-baseline justify-between border-b border-line py-4 text-2xl tracking-tight transition-colors",
                      active ? "text-accent" : "text-muted",
                    )}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] tracking-[0.2em] text-muted">{String(index + 1).padStart(2, "0")}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-10 space-y-6">
              <div className="flex items-center gap-3 sm:hidden">
                <LanguageSwitcher locale={locale} label={languageLabel} />
              </div>
              <SocialLinks links={socials} />
              <a href={`mailto:${email}`} className="block text-sm text-muted underline underline-offset-4">
                {email}
              </a>
              {contactVisible && (
                <Link href={localeHref(locale, "/contact")} className="btn btn-primary w-full">
                  {nav.contact}
                </Link>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
