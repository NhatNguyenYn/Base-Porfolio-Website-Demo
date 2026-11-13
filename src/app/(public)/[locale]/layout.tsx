import type { Metadata } from "next";
import { headers } from "next/headers";
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
import { absoluteUrl } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { safeSocialImage, socialImage } from "@/lib/seo";
import { buildSiteGraph } from "@/lib/structured-data";
import { loadSiteContext } from "@/lib/services/site-context";
import { ServiceUnavailable } from "@/components/site/service-unavailable";
import { PageTransition } from "@/components/site/page-transition";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ThemeScript } from "@/components/site/theme-script";
import { BackToTop } from "@/components/site/back-to-top";

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
  const site = await loadSiteContext();
  if (site.status === "unavailable") {
    // Never advertise an outage page; the layout renders an explicit state.
    return {
      title: locale === "vi" ? "Tạm thời gián đoạn" : "Temporarily unavailable",
      robots: { index: false, follow: false },
    };
  }
  const { settings, profile } = site;
  const content = profile?.translations.find((item) => item.locale === locale);

  const title = content?.seoTitle || (content ? `${content.fullName} — ${content.title}` : settings.seoTitle);
  const description = content?.seoDescription || content?.shortBio || settings.seoDescription;
  const social = safeSocialImage(
    profile?.avatar
      ? socialImage(profile.avatar.url, profile.avatar.alt || content?.fullName || settings.siteName, profile.avatar.width, profile.avatar.height)
      : null,
    settings.siteName,
  );
  const canonical = absoluteUrl(`/${locale}`);

  return {
    metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
    title: { default: title, template: `%s — ${settings.siteName}` },
    description,
    keywords: settings.seoKeywords.split(",").map((item) => item.trim()).filter(Boolean),
    applicationName: settings.siteName,
    alternates: {
      canonical,
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
      url: canonical,
      siteName: settings.siteName,
      images: [social],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: social.url, alt: social.alt }],
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
  // Set by middleware; used to allow our own inline scripts under the CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const site = await loadSiteContext();
  if (site.status === "unavailable") {
    return (
      <html lang={localeHtmlLang[locale]} className={fontVariables} suppressHydrationWarning>
        <head>
          {/* Explicit head tags: the outage shell must never be indexed, even
              when a child page's data query fails during streaming. */}
          <title>{locale === "vi" ? "Tạm thời gián đoạn" : "Temporarily unavailable"}</title>
          <meta name="robots" content="noindex, nofollow" />
        </head>
        <body className="min-h-screen bg-background text-ink">
          <ServiceUnavailable locale={locale} />
        </body>
      </html>
    );
  }

  const { settings, profile, socials, degraded } = site;
  if (degraded) console.warn(`[site-context] rendering /${locale} in degraded mode`);
  const content = profile?.translations.find((item) => item.locale === locale) ?? null;

  const jsonLd = buildSiteGraph({
    locale,
    siteName: settings.siteName,
    description: content?.shortBio || settings.seoDescription,
    person: profile
      ? {
          name: content?.fullName || settings.siteName,
          jobTitle: content?.title,
          description: content?.shortBio,
          // Demo avatars are SVG; structured-data consumers expect a raster image.
          imageUrl: profile.avatar && !/\.svg(?:[?#]|$)/i.test(profile.avatar.url) ? profile.avatar.url : null,
          location: profile.location || undefined,
          aboutUrl: `/${locale}/about`,
          sameAs: socials.filter((link) => link.url.startsWith("http")).map((link) => link.url),
        }
      : null,
  });

  return (
    <html lang={localeHtmlLang[locale]} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme={settings.defaultTheme} nonce={nonce} />
      </head>
      <body className="min-h-screen bg-background text-ink">
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
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
        <BackToTop label={dict.common.backToTop} />
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
