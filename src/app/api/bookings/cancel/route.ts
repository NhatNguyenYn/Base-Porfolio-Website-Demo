import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/db";
import { flowerNameFor } from "@/lib/flowers";
import { fail, ok, readJson, requireSameOrigin, resolveLocale, withApi } from "@/lib/api";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";
import { formatVnDateTime } from "@/lib/booking-time";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const cancelSchema = z.object({
  referenceCode: z.string().trim().min(1).max(16),
  email: z.email().max(160),
});

/**
 * POST /api/bookings/cancel — cancel (or look up) a booking by reference code
 * + email, no login. A wrong code OR a wrong email returns the same generic
 * "not found" so the endpoint is not an enumeration oracle. The response
 * contains only that booking's own summary.
 */
export async function POST(request: Request) {
  return withApi(request, async () => {
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    const body = await readJson(request);
    if (!body) return fail("INVALID_JSON", "Request body must be a JSON object.", 400);
    const locale: Locale = resolveLocale(typeof body.locale === "string" ? body.locale : null) ?? "vi";

    const ip = clientIp(await headers());
    const limit = rateLimit(`booking-cancel:${hashedKey(ip)}`, 5, 10 * 60 * 1000);
    if (!limit.ok) {
      return fail("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
    }

    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      // Same generic message as a mismatch: do not reveal which field is wrong.
      return fail("NOT_FOUND", "No booking matches this reference code and email.", 404);
    }
    const referenceCode = parsed.data.referenceCode.trim().toUpperCase();
    const email = parsed.data.email.trim().toLowerCase();

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { referenceCode },
        include: {
          service: { select: { slug: true, translations: { where: { locale }, select: { name: true } } } },
          slot: { select: { id: true, startsAt: true, endsAt: true, status: true } },
        },
      });
      // Generic "not found" on any mismatch — code wrong, email wrong, or both.
      if (!booking || booking.email.toLowerCase() !== email) return null;
      if (booking.status === "cancelled") return { alreadyCancelled: true as const, booking };
      if (booking.status === "completed") return { completed: true as const, booking };
      if (!["pending", "confirmed"].includes(booking.status)) return null;

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled", cancelledAt: new Date() },
      });
      // Free the slot in the same transaction (the flower is freed by the
      // partial index; flowerCode is never nulled).
      const otherActive = await tx.booking.findFirst({
        where: { slotId: booking.slot.id, status: { in: ["pending", "confirmed"] }, id: { not: booking.id } },
        select: { id: true },
      });
      if (!otherActive) {
        await tx.bookingSlot.update({ where: { id: booking.slot.id }, data: { status: "available" } });
      }
      return { cancelled: true as const, booking: { ...booking, status: updated.status } };
    });

    if (!result) {
      return fail("NOT_FOUND", "No booking matches this reference code and email.", 404);
    }
    if ("alreadyCancelled" in result) {
      return fail("ALREADY_CANCELLED", "This booking was already cancelled.", 409);
    }
    if ("completed" in result) {
      return fail("ALREADY_COMPLETED", "This booking is already completed and cannot be cancelled.", 409);
    }
    const booking = result.booking;
    return ok({
      referenceCode: booking.referenceCode,
      service: booking.service.translations[0]?.name ?? booking.service.slug,
      serviceSlug: booking.service.slug,
      startsAt: booking.slot.startsAt.toISOString(),
      endsAt: booking.slot.endsAt.toISOString(),
      startsAtLabel: formatVnDateTime(booking.slot.startsAt, locale),
      flowerCode: booking.flowerCode,
      flowerName: flowerNameFor(booking.flowerCode, locale),
      status: "cancelled",
    });
  });
}
