// DB + HTTP integration: the 15:17 correction (Phase 10, Agent G).
//
// Booking REQUIRES full contact (name + phone + email); anonymity is
// display-only: the public calendar shows the flower pseudonym, never the
// real name/phone/email, while the admin detail shows everything plus the
// BK- reference code. Real handlers, mocked `next/headers` (see
// survey-flow.test.ts).
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
import { GET as listSlots } from "@/app/api/booking/slots/route";
import { getBookingDetail, listAvailableSlots } from "@/server/queries/bookings";
import { flowerNameFor } from "@/lib/flowers";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers/db";
import {
  createServiceFixture,
  createSlotFixture,
  futureStart,
  REFERENCE_CODE_RE,
  uid,
} from "./helpers/phase10";

type ApiResult = { status: number; json: Record<string, any> };

async function postBooking(body: Record<string, unknown>): Promise<ApiResult> {
  const res = await createBooking(
    new Request("http://localhost:3000/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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

describe("15:17 correction — contact is REQUIRED, anonymity is display-only", () => {
  it("rejects a booking with no name", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(2));
    const before = await prisma.booking.count();
    const { status } = await postBooking({
      email: `noname-${uid()}@example.com`,
      phone: "0901234567",
      notes: "",
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(status).toBe(400);
    expect(await prisma.booking.count()).toBe(before);
  });

  it("rejects a booking with no phone", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(3));
    const before = await prisma.booking.count();
    const { status } = await postBooking({
      name: "Nguyễn Văn A",
      email: `nophone-${uid()}@example.com`,
      notes: "",
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(status).toBe(400);
    expect(await prisma.booking.count()).toBe(before);
  });

  it("rejects a booking with no email, and with a malformed email", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(4));
    const before = await prisma.booking.count();
    for (const email of [undefined, "", "not-an-email"]) {
      const body: Record<string, unknown> = {
        name: "Nguyễn Văn A",
        phone: "0901234567",
        notes: "",
        slotId: slot.id,
        serviceSlug: service.slug,
        answers: [],
        locale: "vi",
      };
      if (email !== undefined) body.email = email;
      const { status } = await postBooking(body);
      expect(status).toBe(400);
    }
    expect(await prisma.booking.count()).toBe(before);
  });

  it("rejects a booking with no contact at all (fully anonymous booking is NOT allowed)", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(5));
    const before = await prisma.booking.count();
    const { status, json } = await postBooking({
      notes: "",
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(status).toBe(400);
    expect(json.error.code).toBe("INVALID");
    expect(await prisma.booking.count()).toBe(before);
  });

  it("public availability shows the flower only — no name, phone or email", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(6));
    const name = "Lê Thị Công Khai";
    const email = `public-pii-${uid()}@example.com`;
    const phone = "0987654321";
    const created = await postBooking({
      name,
      email,
      phone,
      notes: "Ghi chú riêng tư.",
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(created.status).toBe(200);

    // Via the query layer (the safe DTO) and via the HTTP route.
    const dtos = await listAvailableSlots(service.slug, new Date("2026-01-01"), new Date("2030-01-01"), "vi");
    const dto = dtos.find((d) => d.slotId === slot.id);
    expect(dto?.status).toBe("booked");
    expect(dto?.flower?.code).toBe(created.json.data.flowerCode);
    expect(dto?.flower?.name).toBe(flowerNameFor(created.json.data.flowerCode, "vi"));
    expect(JSON.stringify(dtos)).not.toContain(name);
    expect(JSON.stringify(dtos)).not.toContain(email);
    expect(JSON.stringify(dtos)).not.toContain(phone);

    const res = await listSlots(
      new Request(
        `http://localhost:3000/api/booking/slots?service=${service.slug}&locale=vi&from=2026-01-01&to=2030-01-01`,
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain(name);
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain(phone);
    expect(serialized).not.toContain("Ghi chú riêng tư");
    expect(serialized).toContain(created.json.data.flowerName);
  });

  it("admin detail shows full contact + flower + BK- code", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(7));
    const name = "Phạm Văn Quản Trị";
    const email = `admin-view-${uid()}@example.com`;
    const phone = "0911222333";
    const created = await postBooking({
      name,
      email,
      phone,
      notes: "Cần tư vấn về hợp đồng.",
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(created.status).toBe(200);
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { referenceCode: created.json.data.referenceCode },
    });
    const detail = await getBookingDetail(booking.id);
    expect(detail).not.toBeNull();
    expect(detail?.name).toBe(name);
    expect(detail?.email).toBe(email);
    expect(detail?.phone).toBe(phone);
    expect(detail?.notes).toBe("Cần tư vấn về hợp đồng.");
    expect(detail?.referenceCode).toMatch(REFERENCE_CODE_RE);
    expect(detail?.flowerCode).toBe(created.json.data.flowerCode);
    expect(detail?.flowerName).toBe(created.json.data.flowerName);
    expect(detail?.status).toBe("pending");
  });

  it("reference codes are unique across bookings and always match BK- + 6 chars", async () => {
    const service = await createServiceFixture();
    const base = futureStart(8);
    const codes = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const slot = await createSlotFixture(service.id, new Date(base.getTime() + i * 60 * 60 * 1000));
      const { status, json } = await postBooking({
        name: `Người ${i}`,
        email: `unique-${i}-${uid()}@example.com`,
        phone: `090000000${i}`,
        notes: "",
        slotId: slot.id,
        serviceSlug: service.slug,
        answers: [],
        locale: "vi",
      });
      expect(status).toBe(200);
      expect(json.data.referenceCode).toMatch(REFERENCE_CODE_RE);
      codes.add(json.data.referenceCode as string);
    }
    expect(codes.size).toBe(6);
  });

  it("completion payload contains the flower badge name and the BK- code", async () => {
    const service = await createServiceFixture();
    const slot = await createSlotFixture(service.id, futureStart(9));
    const { status, json } = await postBooking({
      name: "Đỗ Thị Hoàn Thành",
      email: `complete-${uid()}@example.com`,
      phone: "0909999888",
      notes: "",
      slotId: slot.id,
      serviceSlug: service.slug,
      answers: [],
      locale: "vi",
    });
    expect(status).toBe(200);
    // Exactly what the completion screen renders: badge (flower name) + code.
    expect(json.data.flowerName).toBe(flowerNameFor(json.data.flowerCode, "vi"));
    expect(json.data.referenceCode).toMatch(REFERENCE_CODE_RE);
    expect(json.data.flowerCode).toBeTruthy();
    expect(json.data.service).toBe(service.slug);
    expect(json.data.startsAt).toBe(slot.startsAt.toISOString());
    expect(json.data.endsAt).toBe(slot.endsAt.toISOString());
  });
});
