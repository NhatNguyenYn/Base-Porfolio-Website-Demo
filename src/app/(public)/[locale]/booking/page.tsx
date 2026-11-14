import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getSettings } from "@/data/settings";
import { listServices } from "@/data/bookings";
import { listUpcomingImportedSchedules } from "@/server/queries/schedules";
import { ImportedScheduleList } from "@/components/site/imported-schedule-list";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/site/page-hero";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const booking = getDictionary(raw).booking;
  const settings = await getSettings();
  return buildPageMetadata({
    locale: raw,
    path: "/booking",
    title: booking.title,
    description: booking.description,
    siteName: settings.siteName,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function BookingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const booking = dict.booking;
  const [services, importedSchedules] = await Promise.all([
    listServices(locale),
    listUpcomingImportedSchedules(),
  ]);

  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: booking.label, href: localeHref(locale, "/booking") },
  ];

  return (
    <>
      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
      </div>
      <PageHero label={booking.label} title={booking.title} description={booking.description} />

      <section className="container-page pb-24">
        <h2 className="text-xl tracking-tight">{booking.serviceListTitle}</h2>
        {services.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{booking.serviceListEmpty}</p>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {services.map((service) => (
              <article key={service.id} className="border border-line bg-surface p-6 sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[17px] tracking-tight">{service.name}</h3>
                  <span className="chip shrink-0">
                    {booking.durationMinutes.replace("{minutes}", String(service.durationMinutes))}
                  </span>
                </div>
                {service.description && (
                  <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{service.description}</p>
                )}
                <div className="mt-6">
                  <Link
                    href={localeHref(locale, `/booking/${service.slug}`)}
                    className="btn btn-primary btn-sm"
                  >
                    {booking.chooseService}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
        {/* D9 — read-only upcoming imported schedules. Placed after the
            service list and BEFORE the cancel/lookup link, so the booking
            flow (services → cancel lookup) keeps its footer at the very
            bottom of the page. No service/slot logic is touched. */}
        <div className="mt-14">
          <h2 className="text-xl tracking-tight">{booking.importedScheduleSectionTitle}</h2>
          <ImportedScheduleList
            schedules={importedSchedules}
            locale={locale}
            emptyLabel={booking.importedScheduleEmpty}
            statusScheduledLabel={booking.importedScheduleStatusScheduled}
            statusConfirmedLabel={booking.importedScheduleStatusConfirmed}
          />
        </div>
        <p className="mt-8 text-[13px] text-muted">
          <Link href={localeHref(locale, "/booking/cancel")} className="underline underline-offset-4 hover:text-ink">
            {booking.viewCancel}
          </Link>
        </p>
      </section>
    </>
  );
}
