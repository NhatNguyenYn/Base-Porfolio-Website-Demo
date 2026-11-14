import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/db";
import { fail, ok, readJson, requireSameOrigin, resolveLocale, withApi } from "@/lib/api";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";
import { formatVnDateTime } from "@/lib/booking-time";
import {
  CONFIRMATION_TTL_MS,
  issueConfirmationToken,
} from "@/lib/booking-confirmation";
import { confirmationEmailConfigured, sendBookingConfirmationEmail } from "@/lib/email";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const resendSchema = z.object({
  referenceCode: z.string().trim().min(1).max(16),
  email: z.email().max(160),
});

/**
 * POST /api/bookings/resend-confirmation — re-send the confirmation mail
 * for a still-pending booking (code + email, no login). Issues a fresh
 * token + 24h expiry. A wrong code OR a wrong email returns the same
 * generic "not found" as the lookup endpoint.
 */
export async function POST(request: Request) {
  return withApi(request, async () => {
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    const body = await readJson(request);
    if (!body) return fail("INVALID_JSON", "Request body must be a JSON object.", 400);
    const locale: Locale = resolveLocale(typeof body.locale === "string" ? body.locale : null) ?? "vi";

    const ip = clientIp(await headers());
    const limit = rateLimit(`booking-resend:${hashedKey(ip)}`, 5, 10 * 60 * 1000);
    if (!limit.ok) {
      return fail("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
    }

    const parsed = resendSchema.safeParse(body);
    if (!parsed.success) {
      return fail("NOT_FOUND", "No booking matches this reference code and email.", 404);
    }
    const referenceCode = parsed.data.referenceCode.trim().toUpperCase();
    const email = parsed.data.email.trim().toLowerCase();

    if (!confirmationEmailConfigured()) {
      return fail("EMAIL_NOT_CONFIGURED", "Confirmation email is not configured.", 503);
    }

    // A lapsed-but-not-yet-swept confirmation is re-issuable: a fresh token
    // + 24h window, the slot was never released. A swept `expired` booking
    // is not — its slot is already free, the visitor books again instead.
    const booking = await prisma.booking.findUnique({
      where: { referenceCode },
      include: {
        service: { select: { slug: true, translations: { where: { locale }, select: { name: true } } } },
        slot: { select: { startsAt: true, endsAt: true } },
      },
    });
    if (!booking || booking.email.toLowerCase() !== email) {
      return fail("NOT_FOUND", "No booking matches this reference code and email.", 404);
    }
    if (booking.status === "confirmed") {
      return fail("ALREADY_CONFIRMED", "This booking is already confirmed.", 409);
    }
    if (booking.status === "cancelled") {
      return fail("ALREADY_CANCELLED", "This booking was already cancelled.", 409);
    }
    if (booking.status === "completed") {
      return fail("ALREADY_COMPLETED", "This booking is already completed.", 409);
    }
    if (booking.status === "expired") {
      return fail("EXPIRED", "This booking's confirmation window has expired. Please book again.", 409);
    }
    if (booking.status !== "pending") {
      return fail("NOT_FOUND", "No booking matches this reference code and email.", 404);
    }

    const { token } = await issueConfirmationToken(prisma, booking.id);
    const baseUrl = (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    const sent = await sendBookingConfirmationEmail({
      to: booking.email,
      locale,
      name: booking.name ?? "",
      serviceName: booking.service.translations[0]?.name ?? booking.service.slug,
      startsAtLabel: formatVnDateTime(booking.slot.startsAt, locale),
      referenceCode: booking.referenceCode,
      confirmUrl: `${baseUrl}${locale === "en" ? "/en" : "/vi"}/dat-lich-khao-sat/xac-nhan?token=${token}`,
      lookupUrl: `${baseUrl}${locale === "en" ? "/en" : "/vi"}/dat-lich-khao-sat/tra-cuu`,
      expiresHours: CONFIRMATION_TTL_MS / 3_600_000,
    });
    if (!sent) {
      return fail("EMAIL_FAILED", "The confirmation email could not be sent. Please try again later.", 502);
    }
    return ok({ sent: true });
  });
}
