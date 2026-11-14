import { randomBytes, createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Booking statuses that hold a slot (and a flower): pending + confirmed. */
export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const;

/**
 * Email confirmation for bookings (anti-ghost).
 *
 * A booking created while email is configured gets an opaque confirmation
 * token (only its SHA-256 is stored) valid for 24 hours. The visitor clicks
 * the link in the email to flip the booking from `pending` to `confirmed`.
 * A pending booking whose confirmation expired is released by
 * releaseExpiredConfirmations() — status becomes `expired` and its slot is
 * freed — so a ghost booking can never hold a slot (or a flower) forever.
 * Bookings created while email is NOT configured get no token and no expiry
 * (today's behaviour: the admin confirms them manually).
 */

/** How long a visitor has to confirm by email before the slot is released. */
export const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Opaque token emailed to the visitor (base64url, 256 bits of entropy). */
export function generateConfirmationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashConfirmationToken(token) };
}

/** SHA-256 hex of the raw token — the only form ever stored or looked up. */
export function hashConfirmationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type BookingDb = PrismaClient | Prisma.TransactionClient;

/**
 * Issue (or re-issue) a confirmation token for a booking: store the hash +
 * a 24h expiry, return the raw token to email. The raw token is never
 * persisted.
 */
export async function issueConfirmationToken(
  db: BookingDb,
  bookingId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const { token, tokenHash } = generateConfirmationToken();
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);
  await db.booking.update({
    where: { id: bookingId },
    data: { confirmationTokenHash: tokenHash, confirmationExpiresAt: expiresAt },
  });
  return { token, expiresAt };
}

/**
 * Release every pending booking whose confirmation expired: mark it
 * `expired` and free its slot when no other active booking holds it.
 * Runs lazily — at the start of the booking-create transaction and of the
 * public slot list — so no cron is needed to keep availability truthful.
 * Returns how many bookings were released.
 */
export async function releaseExpiredConfirmations(db: BookingDb): Promise<number> {
  const now = new Date();
  const expired = await db.booking.findMany({
    where: { status: "pending", confirmationExpiresAt: { not: null, lt: now } },
    select: { id: true, slotId: true },
  });
  if (expired.length === 0) return 0;
  const ids = expired.map((row) => row.id);
  await db.booking.updateMany({ where: { id: { in: ids } }, data: { status: "expired" } });
  const slotIds = [...new Set(expired.map((row) => row.slotId))];
  for (const slotId of slotIds) {
    const other = await db.booking.findFirst({
      where: { slotId, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
      select: { id: true },
    });
    if (!other) {
      await db.bookingSlot.update({ where: { id: slotId }, data: { status: "available" } });
    }
  }
  return expired.length;
}

export type ConfirmOutcome =
  | { outcome: "confirmed"; referenceCode: string; startsAt: string }
  | { outcome: "already-confirmed"; referenceCode: string; startsAt: string }
  | { outcome: "expired"; referenceCode: string }
  | { outcome: "cancelled"; referenceCode: string }
  | { outcome: "completed"; referenceCode: string }
  | { outcome: "not-found" };

/**
 * Confirm a booking by its emailed token. Idempotent: confirming twice
 * reports `already-confirmed` instead of erroring. An expired token reports
 * `expired` (the sweep will release the slot on the next read/write).
 */
export async function confirmBookingByToken(
  db: BookingDb,
  token: string,
): Promise<ConfirmOutcome> {
  // Release anything expired first, so an expired token for this booking is
  // reported as `expired` (and its slot freed) instead of racing the sweep.
  await releaseExpiredConfirmations(db);
  const tokenHash = hashConfirmationToken(token.trim());
  const booking = await db.booking.findUnique({
    where: { confirmationTokenHash: tokenHash },
    select: {
      id: true,
      referenceCode: true,
      status: true,
      confirmationExpiresAt: true,
      slot: { select: { startsAt: true } },
    },
  });
  if (!booking) return { outcome: "not-found" };
  const startsAt = booking.slot.startsAt.toISOString();
  if (booking.status === "confirmed")
    return { outcome: "already-confirmed", referenceCode: booking.referenceCode, startsAt };
  if (booking.status === "cancelled") return { outcome: "cancelled", referenceCode: booking.referenceCode };
  if (booking.status === "completed") return { outcome: "completed", referenceCode: booking.referenceCode };
  if (booking.status === "expired") return { outcome: "expired", referenceCode: booking.referenceCode };
  if (
    booking.status === "pending" &&
    booking.confirmationExpiresAt &&
    booking.confirmationExpiresAt.getTime() < Date.now()
  ) {
    return { outcome: "expired", referenceCode: booking.referenceCode };
  }
  if (booking.status !== "pending") return { outcome: "not-found" };
  await db.booking.update({
    where: { id: booking.id },
    data: { status: "confirmed", confirmedAt: new Date(), confirmationExpiresAt: null },
  });
  return { outcome: "confirmed", referenceCode: booking.referenceCode, startsAt };
}
