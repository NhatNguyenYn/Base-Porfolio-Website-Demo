"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { localeShort, locales, stripLocale, type Locale } from "@/i18n/config";

export function LanguageSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Anchor links (not router.push buttons) so the alternate-language URL is a
  // real, crawlable link with the right href in the HTML.
  function hrefFor(next: Locale): string {
    const { path } = stripLocale(pathname || "/");
    const query = searchParams.toString();
    return `/${next}${path === "/" ? "" : path}${query ? `?${query}` : ""}`;
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-line p-0.5"
      role="group"
      aria-label={label}
    >
      {locales.map((item) => (
        <a
          key={item}
          href={hrefFor(item)}
          hrefLang={item}
          aria-current={item === locale ? "true" : undefined}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] transition-colors ${
            item === locale ? "bg-primary text-primary-fg" : "text-muted hover:text-ink"
          }`}
        >
          {localeShort[item]}
        </a>
      ))}
    </div>
  );
}
