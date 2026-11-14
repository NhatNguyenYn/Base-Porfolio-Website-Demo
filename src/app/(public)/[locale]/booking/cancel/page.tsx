import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getSettings } from "@/data/settings";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/site/page-hero";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { BookingCancelForm } from "@/components/site/booking-cancel-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const booking = getDictionary(raw).booking;
  const settings = await getSettings();
  return buildPageMetadata({
    locale: raw,
    path: "/booking/cancel",
    title: booking.cancelTitle,
    description: booking.cancelDescription,
    siteName: settings.siteName,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function BookingCancelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const booking = dict.booking;

  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: booking.label, href: localeHref(locale, "/booking") },
    { name: booking.cancelTitle, href: localeHref(locale, "/booking/cancel") },
  ];

  return (
    <>
      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
      </div>
      <PageHero label={booking.label} title={booking.cancelTitle} description={booking.cancelDescription} />

      <section className="container-page pb-24">
        <div className="max-w-2xl">
          <BookingCancelForm messages={booking} locale={locale} />
        </div>
      </section>
    </>
  );
}
