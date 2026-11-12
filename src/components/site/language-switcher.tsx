"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale || pending) return;
    const { path } = stripLocale(pathname || "/");
    const query = searchParams.toString();
    const target = `/${next}${path === "/" ? "" : path}${query ? `?${query}` : ""}`;
    startTransition(() => router.push(target));
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-line p-0.5"
      role="group"
      aria-label={label}
    >
      {locales.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => switchTo(item)}
          aria-current={item === locale ? "true" : undefined}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] transition-colors ${
            item === locale ? "bg-primary text-primary-fg" : "text-muted hover:text-ink"
          }`}
        >
          {localeShort[item]}
        </button>
      ))}
    </div>
  );
}
