// Booking confirmation (anti-ghost): token issue/confirm/expiry + lookup
// + resend, with the Resend client mocked (no real mail leaves the test).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockSend = vi.hoisted(() => vi.fn(async () => ({ data: { id: "mail-test" }, error: null })));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

const mockHeaders = vi.hoisted(() => {
  let n = 700;
  return {
    current: {
      get: (name: string) => {
        if (name.toLowerCase() === "x-forwarded-for") {
          n += 1;
          return `203.0.113.${n}`;
        }
        return null;
      },
    } as unknown as Headers,
  };
});
vi.mock("next/headers", () => ({
  headers: async () => mockHeaders.current,
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

import { POST as createBooking } from "@/app/api/bookings/route";
import { POST as lookupBooking } from "@/app/api/bookings/lookup/route";
import { POST as resendConfirmation } from "@/app/api/bookings/resend-confirmation/route";
import {
  CONFIRMATION_TTL_MS,
  confirmBookingByToken,
  generateConfirmationToken,
  hashConfirmationToken,
  issueConfirmationToken,
  releaseExpiredConfirmations,
} from "@/lib/booking-confirmation";
import { listAvailableSlots } from "@/server/queries/bookings";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers/db";
import {
  activeFlowerCodes,
  createServiceFixture,
  createSlotFixture,
  freeFlowerCodes,
  futureStart,
  REFERENCE_CODE_RE,
  uid,
} from "./helpers/phase10";

type ApiResult = { status: number; json: Record<string, any> };

async function post(
  handler: (req: Request) => Promise<Response>,
  url: string,
  body: Record<string, unknown>,
): Promise<ApiResult> {
  const res = await handler(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

const CONTACT = (email: string) => ({
  name: "Nguyễn Văn Kiểm Thử",
  email,
  phone: "0901234567",
  notes: "",
});

async function createBookingViaApi(serviceSlug: string, slotId: string, email: string) {
  return post(createBooking, "http://localhost:3000/api/bookings", {
    ...CONTACT(email),
    slotId,
    serviceSlug,
    answers: [],
    locale: "vi",
  });
}

/** A pending booking row with a booked slot, created directly in the DB. */
async function createPendingBooking(opts: { expired?: boolean } = {}) {
  const service = await createServiceFixture();
  const slot = await createSlotFixture(service.id, futureStart(2));
  const { token, tokenHash } = generateConfirmationToken();
  // The partial unique index allows one active booking per flower: pick a
  // flower no active booking holds yet.
  const flowerCode = freeFlowerCodes(await activeFlowerCodes())[0] ?? "tulip";
  const booking = await prisma.booking.create({
    data: {
      referenceCode: `BK-${uid().slice(0, 6).toUpperCase()}`,
      serviceId: service.id,
      slotId: slot.id,
      name: "Nguyễn Văn Kiểm Thử",
      email: "pending@example.com",
      phone: "0901234567",
      flowerCode,
      status: "pending",
      confirmationTokenHash: tokenHash,
      confirmationExpiresAt: opts.expired
        ? new Date(Date.now() - 60_000)
        : new Date(Date.now() + CONFIRMATION_TTL_MS),
    },
  });
  await prisma.bookingSlot.update({ where: { id: slot.id }, data: { status: "booked" } });
  return { service, slot, booking, token };
}

beforeAll(async () => {
  await resetDatabase();
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "Portfolio Studio <noreply@test.local>";
});

afterAll(async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  await prisma.$disconnect();
});

describe("confirmation tokens", () => {
  it("hashes deterministically and distinct tokens differ", () => {
    const a = generateConfirmationToken();
    const b = generateConfirmationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashConfirmationToken(a.token));
    expect(a.tokenHash).not.toBe(b.tokenHash);
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("confirms a pending booking once, then reports already-confirmed", async () => {
    const { booking, token } = await createPendingBooking();
    const first = await confirmBookingByToken(prisma, token);
    expect(first.outcome).toBe("confirmed");
    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe("confirmed");
    const second = await confirmBookingByToken(prisma, token);
    expect(second.outcome).toBe("already-confirmed");
  });

  it("rejects an unknown token", async () => {
    const result = await confirmBookingByToken(prisma, "no-such-token");
    expect(result.outcome).toBe("not-found");
  });

  it("reports expired for a lapsed token and the sweep frees the slot", async () => {
    const { slot, booking, token } = await createPendingBooking({ expired: true });
    const result = await confirmBookingByToken(prisma, token);
    expect(result.outcome).toBe("expired");
    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe("expired");
    expect((await prisma.bookingSlot.findUnique({ where: { id: slot.id } }))?.status).toBe("available");
  });
});

describe("expiry releases the slot", () => {
  it("an expired pending booking stops blocking its slot in the public list", async () => {
    const { service, slot } = await createPendingBooking({ expired: true });
    const slots = await listAvailableSlots(service.slug, new Date("2026-01-01"), new Date("2030-01-01"), "vi");
    const found = slots.find((row) => row.slotId === slot.id);
    expect(found?.status).toBe("available");
  });

  it("a new booking can take a slot whose previous pending booking expired", async () => {
    const { service, slot, booking } = await createPendingBooking({ expired: true });
    const { status, json } = await createBookingViaApi(service.slug, slot.id, `new-${uid()}@example.com`);
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.referenceCode).toMatch(REFERENCE_CODE_RE);
    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe("expired");
  });

  it("a live pending booking still blocks its slot", async () => {
    const { service, slot } = await createPendingBooking();
    const slots = await listAvailableSlots(service.slug, new Date("2026-01-01"), new Date("2030-01-01"), "vi");
    const found = slots.find((row) => row.slotId === slot.id);
    expect(found?.status).toBe("booked");
  });
});

describe("booking create sends the confirmation mail when configured", () => {
  it("attaches a token + expiry and reports confirmationEmailSent", async () => {
    mockSend.mockClear();
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(4));
    const email = `mail-${uid()}@example.com`;
    const { status, json } = await createBookingViaApi(service.slug, slot.id, email);
    expect(status).toBe(200);
    expect(json.data.confirmationEmailSent).toBe(true);
    expect(json.data.email).toBe(email);
    const stored = await prisma.booking.findUnique({ where: { referenceCode: json.data.referenceCode } });
    expect(stored?.confirmationTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.confirmationExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sent = mockSend.mock.calls[0]?.[0] as { to?: string; subject?: string; text?: string };
    expect(sent.to).toBe(email);
    expect(sent.subject).toContain("Tư vấn kiểm thử");
    expect(sent.text).toContain(json.data.referenceCode);
  });

  it("skips mail (but still books) when email is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    try {
      const service = await createServiceFixture();
      const slot = await createSlotFixture(service.id, futureStart(5));
      const { status, json } = await createBookingViaApi(service.slug, slot.id, `nomail-${uid()}@example.com`);
      expect(status).toBe(200);
      expect(json.data.confirmationEmailSent).toBe(false);
      const stored = await prisma.booking.findUnique({ where: { referenceCode: json.data.referenceCode } });
      expect(stored?.confirmationTokenHash).toBeNull();
      expect(stored?.confirmationExpiresAt).toBeNull();
    } finally {
      process.env.RESEND_API_KEY = "test-key";
    }
  });
});

describe("lookup shows the info card + status", () => {
  it("returns the booking's own details for the right code + email", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(6));
    const email = `lookup-${uid()}@example.com`;
    const created = await createBookingViaApi(service.slug, slot.id, email);
    const code = created.json.data.referenceCode as string;
    const { status, json } = await post(lookupBooking, "http://localhost:3000/api/bookings/lookup", {
      referenceCode: code,
      email,
      locale: "vi",
    });
    expect(status).toBe(200);
    expect(json.data.referenceCode).toBe(code);
    expect(json.data.service).toBe("Tư vấn kiểm thử");
    expect(json.data.name).toBe("Nguyễn Văn Kiểm Thử");
    expect(json.data.email).toBe(email);
    expect(json.data.status).toBe("pending");
    expect(json.data.flowerName).toBeTruthy();
    expect(json.data.canResendConfirmation).toBe(true);
    expect(json.data.confirmationExpiresAt).toBeTruthy();
  });

  it("returns the same generic 404 for a wrong code or a wrong email", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(7));
    const email = `lookup2-${uid()}@example.com`;
    const created = await createBookingViaApi(service.slug, slot.id, email);
    const code = created.json.data.referenceCode as string;
    const wrongEmail = await post(lookupBooking, "http://localhost:3000/api/bookings/lookup", {
      referenceCode: code,
      email: "someone-else@example.com",
      locale: "vi",
    });
    expect(wrongEmail.status).toBe(404);
    expect(wrongEmail.json.error.code).toBe("NOT_FOUND");
    const wrongCode = await post(lookupBooking, "http://localhost:3000/api/bookings/lookup", {
      referenceCode: "BK-XXXXXX",
      email,
      locale: "vi",
    });
    expect(wrongCode.status).toBe(404);
    expect(wrongCode.json.error.code).toBe("NOT_FOUND");
  });

  it("reads an expired pending booking as expired", async () => {
    const { booking } = await createPendingBooking({ expired: true });
    const { status, json } = await post(lookupBooking, "http://localhost:3000/api/bookings/lookup", {
      referenceCode: booking.referenceCode,
      email: "pending@example.com",
      locale: "vi",
    });
    expect(status).toBe(200);
    expect(json.data.status).toBe("expired");
  });
});

describe("resend confirmation", () => {
  it("re-sends the mail with a fresh token for a pending booking", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(8));
    const email = `resend-${uid()}@example.com`;
    const created = await createBookingViaApi(service.slug, slot.id, email);
    const code = created.json.data.referenceCode as string;
    const before = await prisma.booking.findUnique({ where: { referenceCode: code } });
    mockSend.mockClear(); // the create above already sent one mail
    const { status, json } = await post(
      resendConfirmation,
      "http://localhost:3000/api/bookings/resend-confirmation",
      { referenceCode: code, email, locale: "vi" },
    );
    expect(status).toBe(200);
    expect(json.data.sent).toBe(true);
    const after = await prisma.booking.findUnique({ where: { referenceCode: code } });
    expect(after?.confirmationTokenHash).not.toBe(before?.confirmationTokenHash);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("refuses to resend for an already-confirmed booking", async () => {
    const { booking, token } = await createPendingBooking();
    await confirmBookingByToken(prisma, token);
    const { status, json } = await post(
      resendConfirmation,
      "http://localhost:3000/api/bookings/resend-confirmation",
      { referenceCode: booking.referenceCode, email: "pending@example.com", locale: "vi" },
    );
    expect(status).toBe(409);
    expect(json.error.code).toBe("ALREADY_CONFIRMED");
  });

  it("reports EXPIRED for a swept expired booking", async () => {
    const { booking } = await createPendingBooking({ expired: true });
    await releaseExpiredConfirmations(prisma);
    const { status, json } = await post(
      resendConfirmation,
      "http://localhost:3000/api/bookings/resend-confirmation",
      { referenceCode: booking.referenceCode, email: "pending@example.com", locale: "vi" },
    );
    expect(status).toBe(409);
    expect(json.error.code).toBe("EXPIRED");
  });
});

describe("issueConfirmationToken", () => {
  it("stores only the hash and a 24h expiry", async () => {
    const { booking } = await createPendingBooking();
    await prisma.booking.update({
      where: { id: booking.id },
      data: { confirmationTokenHash: null, confirmationExpiresAt: null },
    });
    const before = Date.now();
    const { token, expiresAt } = await issueConfirmationToken(prisma, booking.id);
    expect(token.length).toBeGreaterThan(20);
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(CONFIRMATION_TTL_MS - 1000);
    const stored = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(stored?.confirmationTokenHash).toBe(hashConfirmationToken(token));
    expect(stored?.confirmationTokenHash).not.toContain(token);
  });
});
