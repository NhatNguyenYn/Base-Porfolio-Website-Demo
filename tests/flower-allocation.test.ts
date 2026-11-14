// DB + HTTP integration: flower allocation under concurrency and exhaustion
// (Phase 10, Agent G). Real handlers, mocked `next/headers` (see
// survey-flow.test.ts). Every call gets a fresh X-Forwarded-For identity so
// the booking rate limit never interferes with the flower-pool assertions.
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
import { FLOWERS } from "@/lib/flowers";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers/db";
import {
  activeFlowerCodes,
  countBookings,
  countResponses,
  createServiceFixture,
  createSlotFixture,
  createSurveyFixture,
  futureStart,
  publishSurvey,
  uid,
  validAnswers,
} from "./helpers/phase10";

type ApiResult = { status: number; json: Record<string, any> };

async function book(
  serviceSlug: string,
  slotId: string,
  email: string,
  answers: unknown[] = [],
): Promise<ApiResult> {
  const res = await createBooking(
    new Request("http://localhost:3000/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Nguyễn Văn Kiểm Thử",
        email,
        phone: "0901234567",
        notes: "",
        slotId,
        serviceSlug,
        answers,
        locale: "vi",
      }),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

async function cancel(referenceCode: string, email: string): Promise<ApiResult> {
  const res = await cancelBooking(
    new Request("http://localhost:3000/api/bookings/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ referenceCode, email, locale: "vi" }),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("flower allocation", () => {
  it("N parallel bookings get N distinct flowers", async () => {
    const service = await createServiceFixture();
    const base = futureStart(11);
    const slots = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createSlotFixture(service.id, new Date(base.getTime() + i * 60 * 60 * 1000)),
      ),
    );
    const emails = slots.map((_, i) => `parallel-${i}-${uid()}@example.com`);
    const results = await Promise.all(
      slots.map((slot, i) => book(service.slug, slot.id, emails[i])),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const flowers = results.map((r) => r.json.data.flowerCode as string);
    expect(new Set(flowers).size).toBe(8);
    expect(flowers.every((code) => FLOWERS.some((f) => f.code === code))).toBe(true);

    // Free them again so the pool math below starts from zero.
    for (let i = 0; i < results.length; i++) {
      const cancelled = await cancel(results[i].json.data.referenceCode, emails[i]);
      expect(cancelled.status).toBe(200);
    }
    expect((await activeFlowerCodes()).size).toBe(0);
  });

  it("the public availability response contains no PII, only flower names", async () => {
    // Fresh service with its own seeded PII strings (the parallel test
    // above freed all its flowers, so the pool is empty here).
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(13));
    const piiName = "Trần Thị Bí Mật PII";
    const piiEmail = `pii-secret-${uid()}@example.com`;
    const piiPhone = "0912345678";
      const created = await createBooking(
      new Request("http://localhost:3000/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: piiName,
          email: piiEmail,
          phone: piiPhone,
          notes: "Ghi chú riêng tư PII.",
          slotId: slot.id,
          serviceSlug: service.slug,
          answers: [],
          locale: "vi",
        }),
      }),
    );
    expect(created.status).toBe(200);
    const createdJson = (await created.json()) as Record<string, any>;
    const flowerName = createdJson.data.flowerName as string;

      const res = await listSlots(
      new Request(
        `http://localhost:3000/api/booking/slots?service=${service.slug}&locale=vi&from=2026-01-01&to=2030-01-01`,
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain(piiName);
    expect(serialized).not.toContain(piiEmail);
    expect(serialized).not.toContain(piiPhone);
    expect(serialized).not.toContain("Ghi chú riêng tư PII");
    expect(serialized).not.toContain(createdJson.data.referenceCode);
    const booked = (json.data as { slotId: string; flower: { code: string; name: string } | null }[]).find(
      (s) => s.slotId === slot.id,
    );
    expect(booked?.flower?.name).toBe(flowerName);
    // And the flower name itself IS present (the pseudonym is the point).
    expect(serialized).toContain(flowerName);

    // Free the flower again so the exhaustion test below starts from an
    // empty pool.
    expect((await cancel(createdJson.data.referenceCode, piiEmail)).status).toBe(200);
    expect((await activeFlowerCodes()).size).toBe(0);
  });

  it("cancelling frees the flower and the next booking can reuse it; completing frees it too", async () => {
    // Fill 29 of 30 flowers with active bookings on a service WITH an intake
    // survey, so the exhaustion assertions can also check response rows.
    const intake = await createSurveyFixture({ isBookingIntake: true });
    await publishSurvey(intake.survey.id);
    const service = await createServiceFixture({ intakeSurveyId: intake.survey.id });
    const base = futureStart(12);
    const slotAt = (i: number) => new Date(base.getTime() + i * 60 * 60 * 1000);
    const answers = validAnswers(intake.questions);

    const booked: { referenceCode: string; email: string; flowerCode: string }[] = [];
    for (let i = 0; i < 29; i++) {
      const slot = await createSlotFixture(service.id, slotAt(i));
      const email = `fill-${i}-${uid()}@example.com`;
      const res = await book(service.slug, slot.id, email, answers);
      expect(res.status).toBe(200);
      booked.push({ referenceCode: res.json.data.referenceCode, email, flowerCode: res.json.data.flowerCode });
    }
    expect(new Set(booked.map((b) => b.flowerCode)).size).toBe(29);
    const used = await activeFlowerCodes();
    expect(used.size).toBe(29);
    const onlyFree = FLOWERS.map((f) => f.code).filter((code) => !used.has(code));
    expect(onlyFree).toHaveLength(1);
    const lastFlower = onlyFree[0];

    // The 30th booking must receive the single remaining flower.
    const slotA = await createSlotFixture(service.id, slotAt(29));
    const emailA = `reuse-a-${uid()}@example.com`;
    const bookingA = await book(service.slug, slotA.id, emailA, answers);
    expect(bookingA.status).toBe(200);
    expect(bookingA.json.data.flowerCode).toBe(lastFlower);

    // Cancel → the flower is free again and the next booking reuses it.
    expect((await cancel(bookingA.json.data.referenceCode, emailA)).status).toBe(200);
    expect((await activeFlowerCodes()).has(lastFlower)).toBe(false);
    const slotB = await createSlotFixture(service.id, slotAt(30));
    const emailB = `reuse-b-${uid()}@example.com`;
    const bookingB = await book(service.slug, slotB.id, emailB, answers);
    expect(bookingB.status).toBe(200);
    expect(bookingB.json.data.flowerCode).toBe(lastFlower);

    // Complete → the flower is free again and the next booking reuses it.
    const rowB = await prisma.booking.findUniqueOrThrow({
      where: { referenceCode: bookingB.json.data.referenceCode },
    });
    await prisma.booking.update({ where: { id: rowB.id }, data: { status: "completed" } });
    expect((await activeFlowerCodes()).has(lastFlower)).toBe(false);
    const slotC = await createSlotFixture(service.id, slotAt(31));
    const bookingC = await book(service.slug, slotC.id, `reuse-c-${uid()}@example.com`, answers);
    expect(bookingC.status).toBe(200);
    expect(bookingC.json.data.flowerCode).toBe(lastFlower);
    expect((await activeFlowerCodes()).size).toBe(30);

    // Pool exhausted: the 31st booking is rejected and creates NOTHING.
    const slotD = await createSlotFixture(service.id, slotAt(32));
    const beforeBookings = await countBookings();
    const beforeResponses = await countResponses(intake.survey.id);
    const exhausted = await book(service.slug, slotD.id, `exhausted-${uid()}@example.com`, answers);
    expect(exhausted.status).toBe(409);
    expect(exhausted.json.error.code).toBe("FLOWERS_EXHAUSTED");
    expect(await countBookings()).toBe(beforeBookings);
    expect(await countResponses(intake.survey.id)).toBe(beforeResponses);
    expect((await prisma.bookingSlot.findUnique({ where: { id: slotD.id } }))?.status).toBe("available");
  });


});
