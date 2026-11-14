// DB + HTTP integration: booking flow (Phase 10, Agent G).
//
// The REAL handlers are invoked (POST /api/bookings, POST /api/bookings/
// cancel, GET /api/booking/slots) with `next/headers` mocked per file (see
// survey-flow.test.ts for why). Each call gets a fresh X-Forwarded-For
// identity so the 5-creates/10-min rate limit never bleeds between tests.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockHeaders = vi.hoisted(() => {
  // One stub for every call: each read of X-Forwarded-For returns a fresh
  // IP, so parallel requests never share a rate-limit bucket (the handlers
  // call headers() exactly once per request, for clientIp()).
  let n = 300;
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
import { POST as cancelBooking } from "@/app/api/bookings/cancel/route";
import { GET as listSlots } from "@/app/api/booking/slots/route";
import { FLOWER_CODES } from "@/lib/flowers";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers/db";
import {
  countBookings,
  countResponses,
  createServiceFixture,
  createSlotFixture,
  createSurveyFixture,
  futureStart,
  publishSurvey,
  REFERENCE_CODE_RE,
  setSurveyStatus,
  uid,
  validAnswers,
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

async function getSlots(serviceSlug: string): Promise<ApiResult> {
  const res = await listSlots(
    new Request(
      `http://localhost:3000/api/booking/slots?service=${serviceSlug}&locale=vi&from=2026-01-01&to=2030-01-01`,
    ),
  );
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

const CONTACT = (email: string) => ({
  name: "Nguyễn Văn Kiểm Thử",
  email,
  phone: "0901234567",
  notes: "Ghi chú kiểm thử.",
});

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("booking flow: service + slots → book → cancel/complete", () => {
  it("books a slot with intake answers in one transaction; slot becomes unavailable", async () => {
    const intake = await createSurveyFixture({ isBookingIntake: true });
    await publishSurvey(intake.survey.id);
    const service = await createServiceFixture({ intakeSurveyId: intake.survey.id });
    const slot = await createSlotFixture(service.id, futureStart(2));

    const { status, json } = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(`book-${uid()}@example.com`),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: validAnswers(intake.questions),
      locale: "vi",
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.referenceCode).toMatch(REFERENCE_CODE_RE);
    expect(FLOWER_CODES.has(json.data.flowerCode)).toBe(true);
    expect(typeof json.data.flowerName).toBe("string");

    const stored = await prisma.booking.findUnique({
      where: { referenceCode: json.data.referenceCode },
      include: { surveyResponse: { include: { answers: true } } },
    });
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe("pending");
    expect(stored?.flowerCode).toBe(json.data.flowerCode);
    expect(stored?.surveyResponse).not.toBeNull();
    expect(stored?.surveyResponse?.answers.length).toBeGreaterThan(0);
    expect((await prisma.bookingSlot.findUnique({ where: { id: slot.id } }))?.status).toBe("booked");
  });

  it("rejects a second booking on the same slot with SLOT_TAKEN", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(3));
    const first = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(`first-${uid()}@example.com`),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(first.status).toBe(200);

    const second = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(`second-${uid()}@example.com`),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe("SLOT_TAKEN");
    expect(await prisma.booking.count({ where: { slotId: slot.id } })).toBe(1);
  });

  it("concurrent double-book: two parallel creates for the same slot, exactly one succeeds", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(4));
    const body = (email: string) => ({
      ...CONTACT(email),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    const [a, b] = await Promise.all([
      post(createBooking, "http://localhost:3000/api/bookings", body(`race-a-${uid()}@example.com`)),
      post(createBooking, "http://localhost:3000/api/bookings", body(`race-b-${uid()}@example.com`)),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const failed = a.status === 409 ? a : b;
    expect(failed.json.error.code).toBe("SLOT_TAKEN");
    expect(await prisma.booking.count({ where: { slotId: slot.id, status: { in: ["pending", "confirmed"] } } })).toBe(1);
    expect((await prisma.bookingSlot.findUnique({ where: { id: slot.id } }))?.status).toBe("booked");
  });

  it("invalid intake answers create NO booking and NO response row (atomic)", async () => {
    const intake = await createSurveyFixture({ isBookingIntake: true });
    await publishSurvey(intake.survey.id);
    const service = await createServiceFixture({ intakeSurveyId: intake.survey.id });
    const slot = await createSlotFixture(service.id, futureStart(5));
    const beforeBookings = await countBookings();
    const beforeResponses = await countResponses(intake.survey.id);

    // An option value that passes the zod shape check but is not one of the
    // stored question's declared options — so it reaches the in-transaction
    // validateSurveyAnswers() check (a rating of 99 would already be caught
    // by the zod layer with plain INVALID instead).
    const badAnswers = validAnswers(intake.questions).map((a) =>
      a.type === "single_choice" ? { ...a, optionValues: ["green"] } : a,
    );
    const { status, json } = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(`bad-${uid()}@example.com`),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: badAnswers,
      locale: "vi",
    });
    expect(status).toBe(400);
    expect(json.error.code).toBe("INVALID_ANSWERS");
    expect(await countBookings()).toBe(beforeBookings);
    expect(await countResponses(intake.survey.id)).toBe(beforeResponses);
    expect((await prisma.bookingSlot.findUnique({ where: { id: slot.id } }))?.status).toBe("available");
  });

  it("cancel by reference code + email frees the slot and the flower", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(6));
    const email = `cancel-${uid()}@example.com`;
    const created = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(email),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(created.status).toBe(200);
    const flower = created.json.data.flowerCode as string;

    const cancelled = await post(cancelBooking, "http://localhost:3000/api/bookings/cancel", {
      referenceCode: created.json.data.referenceCode,
      email,
      locale: "vi",
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.json.data.status).toBe("cancelled");
    expect(cancelled.json.data.flowerCode).toBe(flower);

    const stored = await prisma.booking.findUnique({ where: { referenceCode: created.json.data.referenceCode } });
    expect(stored?.status).toBe("cancelled");
    expect(stored?.cancelledAt).not.toBeNull();
    expect(stored?.flowerCode).toBe(flower); // history is kept, never nulled
    expect((await prisma.bookingSlot.findUnique({ where: { id: slot.id } }))?.status).toBe("available");

    // The slot can be booked again after the cancel.
    const rebooked = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(`rebook-${uid()}@example.com`),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(rebooked.status).toBe(200);
  });

  it("completing a booking frees its flower but leaves the slot booked", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(7));
    const created = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(`done-${uid()}@example.com`),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(created.status).toBe(200);
    const flower = created.json.data.flowerCode as string;
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { referenceCode: created.json.data.referenceCode },
    });

    // Admin "complete" transition (mirrors setBookingStatusAction: status only,
    // slot deliberately stays booked — it is in the past).
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: "completed" } });
    });

    const active = await prisma.booking.findMany({
      where: { status: { in: ["pending", "confirmed"] }, flowerCode: flower },
    });
    expect(active).toHaveLength(0);
    expect((await prisma.bookingSlot.findUnique({ where: { id: slot.id } }))?.status).toBe("booked");
  });

  it("closed intake survey blocks booking with SURVEY_CLOSED and creates nothing", async () => {
    const intake = await createSurveyFixture({ isBookingIntake: true });
    await publishSurvey(intake.survey.id);
    await setSurveyStatus(intake.survey.id, "closed");
    const service = await createServiceFixture({ intakeSurveyId: intake.survey.id });
    const slot = await createSlotFixture(service.id, futureStart(8));
    const beforeBookings = await countBookings();
    const beforeResponses = await countResponses(intake.survey.id);

    const { status, json } = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(`blocked-${uid()}@example.com`),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: validAnswers(intake.questions),
      locale: "vi",
    });
    expect(status).toBe(409);
    expect(json.error.code).toBe("SURVEY_CLOSED");
    expect(await countBookings()).toBe(beforeBookings);
    expect(await countResponses(intake.survey.id)).toBe(beforeResponses);
    expect((await prisma.bookingSlot.findUnique({ where: { id: slot.id } }))?.status).toBe("available");
  });

  it("cancel with the right code but the wrong email fails generically and changes nothing", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(9));
    const email = `owner-${uid()}@example.com`;
    const created = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(email),
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(created.status).toBe(200);

    const wrongEmail = await post(cancelBooking, "http://localhost:3000/api/bookings/cancel", {
      referenceCode: created.json.data.referenceCode,
      email: `someone-else-${uid()}@example.com`,
      locale: "vi",
    });
    expect(wrongEmail.status).toBe(404);
    expect(wrongEmail.json.error.code).toBe("NOT_FOUND");

    const wrongCode = await post(cancelBooking, "http://localhost:3000/api/bookings/cancel", {
      referenceCode: "BK-XXXXXX".replace(/X/g, "2"),
      email,
      locale: "vi",
    });
    expect(wrongCode.status).toBe(404);
    expect(wrongCode.json.error.code).toBe("NOT_FOUND");
    // Same generic code for both mismatches: no enumeration oracle.
    expect(wrongCode.json.error.message).toBe(wrongEmail.json.error.message);

    const stored = await prisma.booking.findUnique({ where: { referenceCode: created.json.data.referenceCode } });
    expect(stored?.status).toBe("pending");
    expect((await prisma.bookingSlot.findUnique({ where: { id: slot.id } }))?.status).toBe("booked");
  });

  it("public availability shows the booked slot with flower only, and free slots with no flower", async () => {
    const service = await createServiceFixture();
    const bookedSlot = await createSlotFixture(service.id, futureStart(10, 2));
    const freeSlot = await createSlotFixture(service.id, futureStart(10, 4));
    const created = await post(createBooking, "http://localhost:3000/api/bookings", {
      ...CONTACT(`avail-${uid()}@example.com`),
      slotId: bookedSlot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(created.status).toBe(200);

    const { status, json } = await getSlots(service.slug);
    expect(status).toBe(200);
    const slots = json.data as { slotId: string; status: string; flower: { code: string; name: string } | null }[];
    const booked = slots.find((s) => s.slotId === bookedSlot.id);
    const free = slots.find((s) => s.slotId === freeSlot.id);
    expect(booked?.status).toBe("booked");
    expect(booked?.flower?.code).toBe(created.json.data.flowerCode);
    expect(typeof booked?.flower?.name).toBe("string");
    expect(free?.status).toBe("available");
    expect(free?.flower).toBeNull();
    // No PII anywhere in the serialized availability response.
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("Nguyễn Văn Kiểm Thử");
    expect(serialized).not.toContain("0901234567");
    expect(serialized).not.toContain("avail-");
  });
});
