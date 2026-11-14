// Public booking + intake survey, one page: /[locale]/dat-lich-khao-sat.
//
// Merged 2026-11-14 from /booking, /booking/[serviceSlug] and
// /survey/[slug]: the visitor picks a slot, leaves contact details, answers
// the intake survey and confirms — all on this page. The old routes redirect
// here (see next.config.ts `redirects()`). The first active service is used
// (today there is exactly one: Tư vấn 1-1); with no active service the page
// shows the empty state instead of a broken form.
//
// The "Lịch sắp tới" (upcoming imported schedules) section and the
// lookup/cancel link live below the flow, as they did on the old list page.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getSettings } from "@/data/settings";
import { listServices } from "@/data/bookings";
import { listUpcomingImportedSchedules } from "@/server/queries/schedules";
import { getIntakeSurvey, DEFAULT_BOOKING_THEME } from "@/server/queries/bookings";
import { buildPageMetadata } from "@/lib/seo";
import { dedupeBullets } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ImportedScheduleList } from "@/components/site/imported-schedule-list";
import { BookingFlow } from "@/components/site/booking-flow";
import { BookingIntro } from "@/components/site/booking-intro";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const booking = getDictionary(raw).booking;
  const settings = await getSettings();
  const services = await listServices(raw);
  const result = services[0] ? await getIntakeSurvey(services[0].slug, raw) : null;
  return buildPageMetadata({
    locale: raw,
    path: "/dat-lich-khao-sat",
    title: result?.service ? `${result.service.name} — ${booking.title}` : booking.title,
    description: result?.service.description || booking.description,
    siteName: settings.siteName,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function DatLichKhaoSatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const booking = dict.booking;
  const [services, importedSchedules, settings] = await Promise.all([
    listServices(locale),
    listUpcomingImportedSchedules(),
    getSettings(),
  ]);
  const first = services[0] ?? null;
  const result = first ? await getIntakeSurvey(first.slug, locale) : null;
  const service = result?.service ?? null;
  const survey = result?.survey ?? null;

  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: booking.label, href: localeHref(locale, "/dat-lich-khao-sat") },
  ];

  if (!service) {
    return (
      <>
        <div className="container-page pt-8">
          <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
        </div>
        <PageHero label={booking.label} title={booking.title} description={booking.description} />
        <section className="container-page pb-24">
          <p className="text-sm text-muted">{booking.serviceListEmpty}</p>
        </section>
      </>
    );
  }

  // Closed/archived/missing intake survey -> clear "booking unavailable"
  // message, never a broken form (audit §11.5).
  const unavailable = !survey || !survey.open;
  const unavailableText = !survey ? booking.unavailableNoSurvey : booking.unavailableClosed;

  const theme = survey?.theme ?? DEFAULT_BOOKING_THEME;
  // Brand strip: the intake survey's brand wins; otherwise the site brand.
  const brandName = survey?.theme.brandName ?? settings.siteName;
  const brandLogoUrl = survey?.theme.brandLogoUrl ?? settings.logo?.url ?? null;

  // Intro bullets (15:14 photo reference — spirit only, portfolio brand):
  // question count + estimated time, go-back note, contact purpose + flower
  // anonymity, service info; then any admin-configured highlight lines.
  // NOTE (15:17 correction): booking DOES collect contact info, so the intro
  // must NOT claim "no personal data is collected" — it states the purpose
  // and that the public calendar shows only a flower name.
  // Deduped: a highlight restating an auto fact showed the same line twice
  // (Phase 10 visual check, 2026-11-14).
  const rawBullets: string[] = [];
  if (survey) {
    const countText = booking.introQuestions.replace("{count}", String(survey.questions.length));
    const timeText =
      survey.estimatedMinutes != null
        ? `${countText}, ${booking.introEstimated.replace("{minutes}", String(survey.estimatedMinutes))}`
        : countText;
    rawBullets.push(timeText);
    rawBullets.push(booking.introCanGoBack);
    rawBullets.push(booking.contactPurpose);
    rawBullets.push(booking.introFlowerAnonymity);
    rawBullets.push(
      booking.introServiceInfo
        .replace("{service}", service.name)
        .replace("{minutes}", String(service.durationMinutes)),
    );
    rawBullets.push(...survey.highlights);
  }
  const bullets = dedupeBullets(rawBullets);

  const title = service.name;
  const subtitle = survey?.subtitle || booking.label;
  const description = survey?.description || service.description || booking.description;

  return (
    <>
      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
      </div>
      <BookingIntro
        theme={theme}
        brandName={brandName}
        brandLogoUrl={brandLogoUrl}
        title={title}
        subtitle={subtitle}
        description={description}
        bullets={bullets}
        unavailable={unavailable}
        unavailableTitle={booking.unavailableTitle}
        unavailableText={unavailableText}
      >
        {survey && (
          <BookingFlow
            service={{
              slug: service.slug,
              name: service.name,
              description: service.description,
              durationMinutes: service.durationMinutes,
            }}
            intake={{ title: survey.title, questions: survey.questions }}
            theme={theme}
            locale={locale}
            messages={booking}
          />
        )}
      </BookingIntro>

      {/* D9 — read-only upcoming imported schedules, below the flow and
          BEFORE the cancel/lookup link, so the lookup stays at the very
          bottom of the page. No service/slot logic is touched. */}
      <section className="container-page py-16 lg:py-24">
        <h2 className="text-xl tracking-tight">{booking.importedScheduleSectionTitle}</h2>
        <ImportedScheduleList
          schedules={importedSchedules}
          locale={locale}
          emptyLabel={booking.importedScheduleEmpty}
          statusScheduledLabel={booking.importedScheduleStatusScheduled}
          statusConfirmedLabel={booking.importedScheduleStatusConfirmed}
        />
        <p className="mt-8 text-[13px] text-muted">
          <Link href={localeHref(locale, "/dat-lich-khao-sat/tra-cuu")} className="underline underline-offset-4 hover:text-ink">
            {booking.viewCancel}
          </Link>
        </p>
      </section>
    </>
  );
}
