"use client";

import { usePathname } from "next/navigation";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/config";

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const locale = resolveLocale(pathname?.split("/")[1]);
  const dict = getDictionary(locale);

  return (
    <section className="container-page flex min-h-[55vh] flex-col items-center justify-center py-24 text-center">
      <p className="label">500</p>
      <h1 className="display mt-5 text-[clamp(1.8rem,4vw,3rem)]">{dict.common.error}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{dict.meta.defaultDescription}</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">
        {dict.common.retry}
      </button>
    </section>
  );
}
