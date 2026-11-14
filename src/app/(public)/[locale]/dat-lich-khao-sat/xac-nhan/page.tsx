// Confirm a booking from the link in its confirmation email:
// /[locale]/dat-lich-khao-sat/xac-nhan?token=… — one click, no login.
// The token is verified (SHA-256 hash lookup) and the booking flips from
// `pending` to `confirmed`. Every outcome renders its own card.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getSettings } from "@/data/settings";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/site/page-hero";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { prisma } from "@/server/db";
import { confirmBookingByToken } from "@/lib/booking-confirmation";
import { formatVnDateTime } from "@/lib/booking-time";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const booking = getDictionary(raw).booking;
  const settings = await getSettings();
  return buildPageMetadata({
    locale: raw,
    path: "/dat-lich-khao-sat/xac-nhan",
    title: booking.confirmTitle,
    description: booking.confirmTitle,
    siteName: settings.siteName,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function BookingConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const booking = dict.booking;

  const { token: rawToken } = await searchParams;
  const token = typeof rawToken === "string" ? rawToken : "";

  const outcome = token
    ? await prisma.$transaction((tx) => confirmBookingByToken(tx, token))
    : { outcome: "not-found" as const };

  let title = booking.confirmInvalid;
  if (outcome.outcome === "confirmed" || outcome.outcome === "already-confirmed") {
    title =
      outcome.outcome === "confirmed"
        ? booking.confirmSuccess.replace("{time}", formatVnDateTime(outcome.startsAt, locale))
        : booking.confirmAlready;
  } else if (outcome.outcome === "expired") {
    title = booking.confirmExpired;
  } else if (outcome.outcome === "cancelled") {
    title = booking.confirmCancelled;
  } else if (outcome.outcome === "completed") {
    title = booking.confirmCompleted;
  }

  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: booking.label, href: localeHref(locale, "/dat-lich-khao-sat") },
    { name: booking.confirmTitle, href: localeHref(locale, "/dat-lich-khao-sat/xac-nhan") },
  ];

  return (
    <>
      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
      </div>
      <PageHero label={booking.label} title={booking.confirmTitle} description="" />

      <section className="container-page pb-24">
        <div className="max-w-2xl">
          <div className="border border-line bg-surface p-6 sm:p-8">
            <h2 className="text-xl tracking-tight">{title}</h2>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link href={localeHref(locale, "/dat-lich-khao-sat/tra-cuu")} className="btn btn-outline btn-sm">
                {booking.confirmToLookup}
              </Link>
              <Link href={localeHref(locale, "/dat-lich-khao-sat")} className="btn btn-primary btn-sm">
                {booking.confirmToBooking}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
