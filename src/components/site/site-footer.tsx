import Link from "next/link";
import { localeHref, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { siteNav } from "@/data/navigation";
import { SocialLinks, type SocialLinkItem } from "./social-links";
import { ThemeSwitcher } from "./theme-switcher";
import { LanguageSwitcher } from "./language-switcher";

export type FooterProps = {
  locale: Locale;
  dict: Dictionary;
  siteName: string;
  footerText: string;
  email: string;
  location: string;
  socials: SocialLinkItem[];
  year: number;
  showDemoBadge: boolean;
  nav: { home: string; about: string; projects: string; art: string; blog: string; contact: string };
};

export function SiteFooter({
  locale,
  dict,
  siteName,
  footerText,
  email,
  location,
  socials,
  year,
  showDemoBadge,
  nav,
}: FooterProps) {
  const explore = siteNav(locale, nav).filter((item) =>
    ["about", "projects", "art", "blog"].includes(item.key),
  );

  return (
    <footer className="mt-24 border-t border-line bg-surface-muted/60">
      <div className="container-page py-14 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_0.9fr_1.05fr_0.95fr]">
          <div className="max-w-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
              {dict.home.eyebrow} — {new Date().getFullYear()}
            </p>
            <p className="mt-5 text-2xl leading-tight tracking-tight">{siteName}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted">{footerText}</p>
            {showDemoBadge && (
              <span className="chip mt-6 border-dashed">{dict.footer.demoBadge}</span>
            )}
          </div>

          <div>
            <p className="label">{dict.footer.explore}</p>
            <ul className="mt-4 space-y-2.5">
              {explore.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="underline-sweep text-sm text-muted hover:text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label">{dict.footer.contact}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              <li>
                <a href={`mailto:${email}`} className="underline-sweep hover:text-ink">
                  {email}
                </a>
              </li>
              {location && <li>{location}</li>}
              <li>
                <Link href={localeHref(locale, "/contact")} className="underline-sweep hover:text-ink">
                  {dict.contact.formTitle}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="label">{dict.footer.elsewhere}</p>
            <SocialLinks links={socials} className="mt-4 gap-1.5 [&_a]:h-8 [&_a]:w-8" />
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] tracking-[0.04em] text-muted">
            © {year} {siteName}. {dict.footer.rights}
          </p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher locale={locale} label={dict.common.language} />
            <ThemeSwitcher
              labels={{ theme: dict.common.theme, light: dict.common.light, dark: dict.common.dark }}
            />

          </div>
        </div>
      </div>
    </footer>
  );
}
