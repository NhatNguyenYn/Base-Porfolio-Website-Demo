import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import { fontVariables } from "@/app/fonts";
import { getDictionary } from "@/i18n";
import {
  alternateLocale,
  isLocale,
  localeHtmlLang,
  localeOgLocale,
  locales,
  type Locale,
} from "@/i18n/config";
import { getSettings } from "@/data/settings";
import { getProfile } from "@/data/profile";
import { getSocialLinks } from "@/data/social";
import { absoluteUrl } from "@/lib/utils";
import { PageTransition } from "@/components/site/page-transition";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ThemeScript } from "@/components/site/theme-script";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

// Static-export build (GitHub Pages demo): enumerate the locales so every
// public page under this layout can prerender. Ignored by the dynamic build.
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;
  const [settings, profile] = await Promise.all([getSettings(), getProfile()]);
  const content = profile?.translations.find((item) => item.locale === locale);

  const title = content?.seoTitle || (content ? `${content.fullName} — ${content.title}` : settings.seoTitle);
  const description = content?.seoDescription || content?.shortBio || settings.seoDescription;

  return {
    metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
    title: { default: title, template: `%s — ${settings.siteName}` },
    description,
    keywords: settings.seoKeywords.split(",").map((item) => item.trim()).filter(Boolean),
    applicationName: settings.siteName,
    alternates: {
      canonical: absoluteUrl(`/${locale}`),
      languages: {
        vi: absoluteUrl("/vi"),
        en: absoluteUrl("/en"),
        "x-default": absoluteUrl("/vi"),
      },
    },
    openGraph: {
      type: "website",
      locale: localeOgLocale[locale],
      alternateLocale: localeOgLocale[alternateLocale(locale)],
      title,
      description,
      url: absoluteUrl(`/${locale}`),
      siteName: settings.siteName,
      images: profile?.avatar ? [{ url: profile.avatar.url, alt: content?.fullName ?? settings.siteName }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    icons: settings.favicon ? { icon: settings.favicon.url } : undefined,
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const [settings, profile, socials] = await Promise.all([getSettings(), getProfile(), getSocialLinks()]);
  const content = profile?.translations.find((item) => item.locale === locale) ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: settings.siteName,
        url: absoluteUrl(`/${locale}`),
        inLanguage: localeHtmlLang[locale],
        description: content?.shortBio || settings.seoDescription,
      },
      ...(profile
        ? [
            {
              "@type": "Person",
              name: content?.fullName || profile.email,
              jobTitle: content?.title,
              description: content?.shortBio,
              image: profile.avatar ? absoluteUrl(profile.avatar.url) : undefined,
              email: profile.email,
              address: profile.location || undefined,
              url: absoluteUrl(`/${locale}/about`),
              sameAs: socials.filter((link) => link.url.startsWith("http")).map((link) => link.url),
            },
          ]
        : []),
    ],
  };

  return (
    <html lang={localeHtmlLang[locale]} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme={settings.defaultTheme} />
      </head>
      <body className="min-h-screen bg-background text-ink">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
        >
          {dict.common.skipToContent}
        </a>
        <SiteHeader
          locale={locale}
          siteName={settings.siteName}
          nav={dict.nav}
          themeLabels={{ theme: dict.common.theme, light: dict.common.light, dark: dict.common.dark }}
          languageLabel={dict.common.language}
          socials={socials}
          email={settings.contactEmail}
        />
        <PageTransition>{children}</PageTransition>
        <SiteFooter
          locale={locale}
          dict={dict}
          siteName={settings.siteName}
          footerText={locale === "vi" ? settings.footerText : settings.footerTextEn || settings.footerText}
          email={settings.contactEmail}
          location={settings.contactLocation}
          socials={socials}
          year={new Date().getFullYear()}
          showDemoBadge={settings.showDemoBadge}
          nav={dict.nav}
        />
      </body>
    </html>
  );
}
