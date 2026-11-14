"use client";

import Link from "next/link";
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

  // `next/link` renders a real <a> in the HTML, so the alternate-language
  // URL stays a crawlable link — and unlike a hand-built <a href>, Link
  // prefixes the deploy basePath automatically. (A raw <a> with
  // `/${next}${path}` 404d on the GitHub Pages demo, whose pages live under
  // /Base-Porfolio-Website-Demo; `usePathname()` does not include basePath.)
  // `hrefFor` therefore stays base-path-free on purpose: adding the prefix
  // here would double-prefix.
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
        <Link
          key={item}
          href={hrefFor(item)}
          hrefLang={item}
          aria-current={item === locale ? "true" : undefined}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] transition-colors ${
            item === locale ? "bg-primary text-primary-fg" : "text-muted hover:text-ink"
          }`}
        >
          {localeShort[item]}
        </Link>
      ))}
    </div>
  );
}
