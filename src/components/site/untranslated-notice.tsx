import Link from "next/link";
import { localeNames, type Locale } from "@/i18n/config";

export function UntranslatedNotice({
  currentLocale,
  alternateHref,
  alternate,
  title,
  text,
  switchLabel,
}: {
  currentLocale: Locale;
  alternate: Locale;
  alternateHref: string;
  title: string;
  text: string;
  switchLabel: string;
}) {
  return (
    <section className="container-page py-24 lg:py-32">
      <div className="mx-auto max-w-xl border border-line bg-surface p-10 text-center">
        <p className="label">{localeNames[currentLocale]}</p>
        <h1 className="mt-4 text-2xl tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
        <Link href={alternateHref} className="btn btn-primary mt-8">
          {switchLabel} {localeNames[alternate]}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
