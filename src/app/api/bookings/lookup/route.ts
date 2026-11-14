import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/db";
import { flowerNameFor } from "@/lib/flowers";
import { fail, ok, readJson, requireSameOrigin, resolveLocale, withApi } from "@/lib/api";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";
import { formatVnDateTime } from "@/lib/booking-time";
import { confirmationEmailConfigured } from "@/lib/email";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const lookupSchema = z.object({
  referenceCode: z.string().trim().min(1).max(16),
  email: z.email().max(160),
});

/**
 * POST /api/bookings/lookup — look up a booking by reference code + email,
 * no login. Returns the booking's own info card: service, time, contact,
 * flower and current status (pending/confirmed/completed/cancelled/expired).
 * A wrong code OR a wrong email returns the same generic "not found" so the
 * endpoint is not an enumeration oracle.
 */
export async function POST(request: Request) {
  return withApi(request, async () => {
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    const body = await readJson(request);
    if (!body) return fail("INVALID_JSON", "Request body must be a JSON object.", 400);
    const locale: Locale = resolveLocale(typeof body.locale === "string" ? body.locale : null) ?? "vi";

    const ip = clientIp(await headers());
    const limit = rateLimit(`booking-lookup:${hashedKey(ip)}`, 10, 10 * 60 * 1000);
    if (!limit.ok) {
      return fail("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
    }

    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      // Same generic message as a mismatch: do not reveal which field is wrong.
      return fail("NOT_FOUND", "No booking matches this reference code and email.", 404);
    }
    const referenceCode = parsed.data.referenceCode.trim().toUpperCase();
    const email = parsed.data.email.trim().toLowerCase();

    const booking = await prisma.booking.findUnique({
      where: { referenceCode },
      include: {
        service: { select: { slug: true, translations: { where: { locale }, select: { name: true } } } },
        slot: { select: { startsAt: true, endsAt: true } },
      },
    });
    // Generic "not found" on any mismatch — code wrong, email wrong, or both.
    if (!booking || booking.email.toLowerCase() !== email) {
      return fail("NOT_FOUND", "No booking matches this reference code and email.", 404);
    }

    // A pending booking whose confirmation lapsed reads as expired even
    // before the next sweep releases its slot.
    const confirmationExpired =
      booking.status === "pending" &&
      booking.confirmationExpiresAt !== null &&
      booking.confirmationExpiresAt.getTime() < Date.now();
    const status = confirmationExpired ? "expired" : booking.status;

    return ok({
      referenceCode: booking.referenceCode,
      service: booking.service.translations[0]?.name ?? booking.service.slug,
      serviceSlug: booking.service.slug,
      startsAt: booking.slot.startsAt.toISOString(),
      endsAt: booking.slot.endsAt.toISOString(),
      startsAtLabel: formatVnDateTime(booking.slot.startsAt, locale),
      name: booking.name,
      email: booking.email,
      phone: booking.phone ?? "",
      flowerCode: booking.flowerCode,
      flowerName: flowerNameFor(booking.flowerCode, locale),
      status,
      createdAt: booking.createdAt.toISOString(),
      confirmationExpiresAt: booking.confirmationExpiresAt?.toISOString() ?? null,
      // Resend is offered only when the booking is still waiting on its
      // confirmation mail and mail is actually configured.
      canResendConfirmation:
        booking.status === "pending" &&
        booking.confirmationTokenHash !== null &&
        confirmationEmailConfigured(),
    });
  });
}
