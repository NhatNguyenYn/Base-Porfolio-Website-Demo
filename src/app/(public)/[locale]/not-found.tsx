"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/config";

export default function LocaleNotFound() {
  const pathname = usePathname();
  const segment = pathname?.split("/")[1];
  const locale = resolveLocale(segment);
  const dict = getDictionary(locale);

  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="label">404</p>
      <h1 className="display mt-6 text-[clamp(2rem,5vw,3.6rem)]">{dict.notFound.title}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{dict.notFound.text}</p>
      <Link href={`/${locale}`} className="btn btn-primary mt-8">
        {dict.notFound.home}
      </Link>
    </section>
  );
}
