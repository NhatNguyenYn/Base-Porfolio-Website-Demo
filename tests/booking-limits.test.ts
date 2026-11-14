// Unit tests for booking limits + time conversion (Phase 10, Agent G).
// Pure helpers only — no database.
//
// NOTE on the reference code: the generator itself
// (generateReferenceCode in src/app/api/bookings/route.ts) is not exported,
// so its alphabet is verified indirectly here through the constants in
// src/lib/booking-limits.ts, and end-to-end through real booking responses
// in tests/booking-flow.test.ts and tests/booking-anon.test.ts, which assert
// every returned code matches /^BK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.
import { describe, expect, it } from "vitest";
import {
  BOOKING_REFERENCE_CODE_PREFIX,
  BOOKING_REFERENCE_CODE_RANDOM_LENGTH,
  BOOKING_SLOT_DURATIONS_MINUTES,
  FLOWER_ALLOC_RETRIES,
} from "@/lib/booking-limits";
import { bookingServiceSchema, bookingSlotSchema } from "@/lib/validation";
import {
  deriveEndsAt,
  utcToVnLocalParts,
  vnLocalToUtc,
} from "@/lib/booking-time";
import { REFERENCE_CODE_RE } from "./helpers/phase10";

describe("slot UTC <-> VN conversion (both ways)", () => {
  it("converts VN wall-clock to UTC and back (round-trip, several dates)", () => {
    for (const [date, time] of [
      ["2026-11-16", "09:00"],
      ["2026-11-17", "01:30"],
      ["2026-12-31", "23:59"],
      ["2027-01-01", "00:00"],
      ["2026-06-15", "14:45"],
    ] as const) {
      const utc = vnLocalToUtc(date, time);
      expect(utc).not.toBeNull();
      expect(utcToVnLocalParts(utc as Date)).toEqual({ date, time });
    }
  });

  it("shifts by exactly +7h (Asia/Ho_Chi_Minh has no DST)", () => {
    // 09:00 VN = 02:00 UTC; the reverse direction shows 09:00 again.
    expect(vnLocalToUtc("2026-11-16", "09:00")?.toISOString()).toBe("2026-11-16T02:00:00.000Z");
    expect(utcToVnLocalParts(new Date("2026-11-16T02:00:00.000Z"))).toEqual({
      date: "2026-11-16",
      time: "09:00",
    });
    // A late-evening VN time crosses the UTC date boundary both ways.
    expect(vnLocalToUtc("2026-11-17", "01:30")?.toISOString()).toBe("2026-11-16T18:30:00.000Z");
    expect(utcToVnLocalParts(new Date("2026-11-16T18:30:00.000Z"))).toEqual({
      date: "2026-11-17",
      time: "01:30",
    });
  });

  it("derives endsAt from startsAt + duration server-side", () => {
    const start = new Date("2026-11-16T02:00:00.000Z");
    expect(deriveEndsAt(start, 30).toISOString()).toBe("2026-11-16T02:30:00.000Z");
    expect(deriveEndsAt(start, 15).toISOString()).toBe("2026-11-16T02:15:00.000Z");
    expect(deriveEndsAt(start, 60).toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });
});

describe("reference-code format (BK- + 6 chars)", () => {
  it("has prefix BK- and a 6-character random part", () => {
    expect(BOOKING_REFERENCE_CODE_PREFIX).toBe("BK-");
    expect(BOOKING_REFERENCE_CODE_RANDOM_LENGTH).toBe(6);
  });

  it("accepts a well-formed code and rejects ambiguous characters", () => {
    expect(REFERENCE_CODE_RE.test("BK-7K2M9Q")).toBe(true);
    expect(REFERENCE_CODE_RE.test("BK-234567")).toBe(true);
    // Ambiguous alphabet: 0/O, 1/I/l must never appear.
    expect(REFERENCE_CODE_RE.test("BK-012345")).toBe(false); // 0, 1
    expect(REFERENCE_CODE_RE.test("BK-ABCDEO")).toBe(false); // O
    expect(REFERENCE_CODE_RE.test("BK-ABCDEI")).toBe(false); // I
    expect(REFERENCE_CODE_RE.test("BK-ABCDEl")).toBe(false); // lowercase l
    expect(REFERENCE_CODE_RE.test("BK-abcdef")).toBe(false); // lowercase
    expect(REFERENCE_CODE_RE.test("BK-7K2M9")).toBe(false); // too short
    expect(REFERENCE_CODE_RE.test("BK-7K2M9Q8")).toBe(false); // too long
    expect(REFERENCE_CODE_RE.test("7K2M9Q")).toBe(false); // missing prefix
    expect(REFERENCE_CODE_RE.test("bk-7K2M9Q")).toBe(false); // lowercase prefix
  });

  it("retries flower/slot races a bounded number of times", () => {
    expect(FLOWER_ALLOC_RETRIES).toBe(5);
  });
});

describe("duration allow-list", () => {
  it("allows only 15, 30 and 60 minutes", () => {
    expect([...BOOKING_SLOT_DURATIONS_MINUTES]).toEqual([15, 30, 60]);
  });

  it("accepts 15/30/60 in the service schema and rejects anything else", () => {
    const base = {
      slug: "tu-van-1-1",
      active: true,
      order: 0,
      vi: { name: "Tư vấn 1-1", description: "" },
      en: { name: "Consultation", description: "" },
    };
    for (const duration of [15, 30, 60]) {
      expect(bookingServiceSchema.safeParse({ ...base, durationMinutes: duration }).success).toBe(true);
    }
    for (const duration of [10, 20, 45, 90, 120, 0, -30]) {
      expect(bookingServiceSchema.safeParse({ ...base, durationMinutes: duration }).success).toBe(false);
    }
  });

  it("rejects a slot whose end is not after its start", () => {
    const start = "2026-11-16T02:00:00.000Z";
    expect(
      bookingSlotSchema.safeParse({ serviceId: "svc-1", startsAt: start, endsAt: "2026-11-16T02:30:00.000Z" })
        .success,
    ).toBe(true);
    expect(
      bookingSlotSchema.safeParse({ serviceId: "svc-1", startsAt: start, endsAt: start }).success,
    ).toBe(false);
    expect(
      bookingSlotSchema.safeParse({ serviceId: "svc-1", startsAt: start, endsAt: "2026-11-16T01:30:00.000Z" })
        .success,
    ).toBe(false);
  });
});
