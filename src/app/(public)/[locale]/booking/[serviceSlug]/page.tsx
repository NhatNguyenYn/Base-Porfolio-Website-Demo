import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getSettings } from "@/data/settings";
import { getIntakeSurvey, DEFAULT_BOOKING_THEME } from "@/server/queries/bookings";
import { buildPageMetadata } from "@/lib/seo";
import { dedupeBullets } from "@/lib/utils";
import { BookingFlow } from "@/components/site/booking-flow";
import { BookingIntro } from "@/components/site/booking-intro";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serviceSlug: string }>;
}): Promise<Metadata> {
  const { locale: raw, serviceSlug } = await params;
  if (!isLocale(raw)) return {};
  const booking = getDictionary(raw).booking;
  const settings = await getSettings();
  const result = await getIntakeSurvey(serviceSlug, raw);
  return buildPageMetadata({
    locale: raw,
    path: `/booking/${serviceSlug}`,
    title: result?.service ? `${result.service.name} — ${booking.title}` : booking.title,
    description: result?.service.description || booking.description,
    siteName: settings.siteName,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function BookingServicePage({
  params,
}: {
  params: Promise<{ locale: string; serviceSlug: string }>;
}) {
  const { locale: raw, serviceSlug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const booking = getDictionary(locale).booking;
  const [result, settings] = await Promise.all([getIntakeSurvey(serviceSlug, locale), getSettings()]);
  if (!result) notFound();
  const { service, survey } = result;

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
  );
}
