// Public survey page: /[locale]/survey/[slug] (Phase 10, Agent C).
//
// Only a published survey inside its window, with a translation in the
// requested locale, renders the wizard. Draft / not-yet-started /
// missing-translation 404 (with noindex metadata) — the survey is never
// half-rendered in the wrong language and never leaks admin state.
// Closed / archived / expired surveys render the intro + a pink "survey
// ended" status card (15:14 photo reference) instead of a bare 404.
//
// The intro (brand band, italic subtitle, editorial title, coloured-dot
// bullets) lives in the wizard's intro phase — the page does not render a
// separate PageHero, so the title appears exactly once.
//
// generateMetadata reads params + DB only. It never awaits searchParams:
// awaiting searchParams silently opts the route out of static generation
// (proven twice before), and this page must keep the exact
// `export const dynamic = "force-dynamic";` literal for the export staging
// rewrite (see .github/workflows/pages.yml).
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getClosedSurveyDisplay, getPublishedSurvey, getSurveyLocales } from "@/data/surveys";
import { getSettings } from "@/data/settings";
import { buildPageMetadata } from "@/lib/seo";
import { assetUrl } from "@/lib/asset";
import { SurveyWizard } from "@/components/site/survey-wizard";
import { SurveyIntro } from "@/components/site/survey-intro";
import { SurveyTheme } from "@/components/site/survey-theme";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const settings = await getSettings();
  const messages = getDictionary(raw).survey;
  const { status, survey } = await getPublishedSurvey(slug, raw);
  if (status === "ok" && survey) {
    const available = await getSurveyLocales(slug);
    return buildPageMetadata({
      locale: raw,
      path: `/survey/${slug}`,
      title: survey.title,
      description: survey.description || survey.subtitle || survey.title,
      siteName: settings.siteName,
      availableLocales: available,
      image: survey.cover
        ? {
            url: survey.cover.url,
            alt: survey.cover.alt || survey.title,
            width: survey.cover.width ?? undefined,
            height: survey.cover.height ?? undefined,
          }
        : null,
      faviconUrl: settings.favicon?.url,
    });
  }
  // Closed surveys get a noindex page with their real title; everything else
  // (draft / missing / untranslated) stays out of the index with a generic title.
  const closed = status === "closed" ? await getClosedSurveyDisplay(slug, raw) : { survey: null };
  return buildPageMetadata({
    locale: raw,
    path: `/survey/${slug}`,
    title: closed.survey?.title ?? messages.notTranslatedTitle,
    description: closed.survey?.description || messages.notTranslatedText,
    siteName: settings.siteName,
    noindex: true,
  });
}

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const messages = getDictionary(locale).survey;
  const settings = await getSettings();

  const { status, survey } = await getPublishedSurvey(slug, locale);

  if (status === "closed") {
    const closed = await getClosedSurveyDisplay(slug, locale);
    if (!closed.survey) notFound();
    const closedSurvey = closed.survey;
    return (
      <div className="container-page min-w-0 pb-16 pt-10">
        <SurveyTheme theme={closedSurvey.theme}>
          <div
            className="border border-line bg-[var(--survey-background)] px-4 py-8 sm:px-8 sm:py-10"
            style={{ borderRadius: "var(--survey-radius)" }}
          >
            <SurveyIntro
              survey={closedSurvey}
              messages={messages}
              brandName={closedSurvey.brandName ?? settings.siteName}
              brandLogoUrl={closedSurvey.brandLogo?.url ?? settings.logo?.url ?? null}
              mode="closed"
            />
          </div>
        </SurveyTheme>
      </div>
    );
  }

  if (status !== "ok" || !survey) notFound();

  return (
    <div>
      {survey.cover && survey.theme.layout !== "split" && (
        <div className="container-page pt-10">
          <div className="relative aspect-[16/9] overflow-hidden border border-line bg-surface-muted">
            <Image
              src={assetUrl(survey.cover.url)}
              alt={survey.cover.alt || survey.title}
              fill
              priority
              sizes="(min-width: 1440px) 1344px, 92vw"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <div className="container-page min-w-0 pb-16 pt-10">
        <SurveyWizard
          survey={survey}
          messages={messages}
          locale={locale}
          homeHref={localeHref(locale, "/")}
          brand={{
            name: survey.brandName ?? settings.siteName,
            logoUrl: survey.brandLogo?.url ?? settings.logo?.url ?? null,
          }}
        />
      </div>
    </div>
  );
}
