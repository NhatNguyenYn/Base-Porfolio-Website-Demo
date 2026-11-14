import { headers } from "next/headers";
import { listAvailableSlots, type PublicSlotDto } from "@/server/queries/bookings";
import { AVAILABILITY_LIMIT } from "@/lib/booking-limits";
import { fail, ok, publicCache, resolveLocale, withApi } from "@/lib/api";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/booking/slots?service=<slug>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>&locale=vi
 *
 * Public availability. Returns the safe DTO only: slot id, service slug,
 * UTC start/end, status, and — for a taken slot — the flower code + localized
 * flower name. Nothing else is selected or returned for a taken slot.
 */
export async function GET(request: Request) {
  return withApi(request, async () => {
    const params = new URL(request.url).searchParams;
    const locale = resolveLocale(params.get("locale"));
    if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

    const service = params.get("service")?.trim();
    if (!service) return fail("INVALID_SERVICE", "service is required.", 400);

    const ip = clientIp(await headers());
    const limit = rateLimit(
      `booking-slots:${hashedKey(ip)}`,
      AVAILABILITY_LIMIT.limit,
      AVAILABILITY_LIMIT.windowMs,
    );
    if (!limit.ok) {
      return fail("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
    }

    const now = new Date();
    const fromParam = params.get("from");
    const toParam = params.get("to");
    const from = fromParam ? new Date(`${fromParam}T00:00:00Z`) : now;
    const to = toParam
      ? new Date(`${toParam}T23:59:59.999Z`)
      : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return fail("INVALID_RANGE", "from/to must be valid dates with to after from.", 400);
    }

    const slots: PublicSlotDto[] = await listAvailableSlots(service, from, to, locale);
    return ok(slots, { locale }, publicCache);
  });
}
