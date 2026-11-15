// Phase 12 — booking-slot sync tests.
//
// When a schedule JSON is imported, the engine also maintains BookingSlot
// rows for the site's default booking service (first active service), so an
// imported time is bookable right away — like the 2026-11-14 demo slots —
// instead of display-only. A booked slot is never deleted or retimed, and
// a slot failure never fails the import.
//
// DB-backed integration tests against `portfolio_test` only. The booking
// tables are wiped in beforeEach/afterAll because the engine picks the
// first active service globally: leftovers from the Phase 10 booking
// suites (or from this file) would otherwise be picked instead of the
// fixture service.
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import {
  applyScheduleImport,
  computeScheduleImportPayloadHash,
  previewScheduleImport,
} from "@/server/schedule-import/engine";
import type { ValidatedSchedule } from "@/lib/schedule-import-schema";
import {
  makeTestConnection,
  makeValidatedSchedule,
  seedImportedSchedule,
  uid,
  wipeScheduleImportTables,
} from "./helpers/phase11";

const SOURCE = "external_agent";

async function wipeBookingTables(): Promise<void> {
  // Restrict FKs: bookings first, then slots, then services.
  await prisma.booking.deleteMany();
  await prisma.bookingSlot.deleteMany();
  await prisma.bookingService.deleteMany();
}

async function makeActiveService(): Promise<{ id: string; slug: string }> {
  const slug = `svc-slots-${uid()}`;
  return prisma.bookingService.create({
    data: { slug, durationMinutes: 30, active: true },
    select: { id: true, slug: true },
  });
}

async function countSlots(serviceId: string): Promise<number> {
  return prisma.bookingSlot.count({ where: { serviceId } });
}

async function slotAt(serviceId: string, startsAt: Date) {
  return prisma.bookingSlot.findFirst({ where: { serviceId, startsAt } });
}

function at(hourUtc: number): Date {
  return new Date(`2026-11-20T${String(hourUtc).padStart(2, "0")}:00:00.000Z`);
}

describe("schedule import — booking slot sync (Phase 12)", () => {
  beforeEach(async () => {
    await wipeScheduleImportTables();
    await wipeBookingTables();
  });

  afterAll(async () => {
    await wipeScheduleImportTables();
    await wipeBookingTables();
  });

  it("creates a bookable slot for each new scheduled/confirmed schedule", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const schedules = [
      makeValidatedSchedule({ externalId: "SLOT-1", title: "Hẹn 1" }),
      makeValidatedSchedule({
        externalId: "SLOT-2",
        title: "Hẹn 2",
        status: "confirmed",
        startsAt: at(4),
        endsAt: at(5),
      }),
    ];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary.serviceSlug).toBe(service.slug);
    expect(summary.slots).toMatchObject({ created: 2, moved: 0, removed: 0, kept: 0, failed: 0 });
    expect(summary.items.map((item) => item.slot)).toEqual(["created", "created"]);
    expect(await countSlots(service.id)).toBe(2);

    const first = await slotAt(service.id, at(2));
    expect(first?.status).toBe("available");
    expect(first?.startsAt.toISOString()).toBe(at(2).toISOString());
    expect(first?.endsAt.toISOString()).toBe(at(3).toISOString());
  });

  it("creates no slot for a new cancelled schedule", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const schedules = [makeValidatedSchedule({ externalId: "SLOT-CX", status: "cancelled" })];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary).toMatchObject({ created: 1, cancelled: 0 });
    expect(summary.slots).toMatchObject({ created: 0, removed: 0, failed: 0 });
    expect(summary.items[0].slot).toBeUndefined();
    expect(await countSlots(service.id)).toBe(0);
  });

  it("preview plans the slots without writing any", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const schedules = [makeValidatedSchedule({ externalId: "SLOT-PV" })];
    const summary = await previewScheduleImport({ connectionId: connection.id, source: SOURCE, schedules });

    expect(summary.slots).toMatchObject({ created: 1 });
    expect(summary.items[0].slot).toBe("created");
    expect(await countSlots(service.id)).toBe(0);
    expect(await prisma.importedSchedule.count()).toBe(0);
  });

  it("moves the slot when the schedule time moves", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const seeded = await seedImportedSchedule(connection.id, { externalId: "SLOT-MV" });
    await prisma.bookingSlot.create({
      data: { serviceId: service.id, startsAt: seeded.startsAt, endsAt: seeded.endsAt, status: "available" },
    });
    const schedules = [
      makeValidatedSchedule({ externalId: "SLOT-MV", startsAt: at(6), endsAt: at(7) }),
    ];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary).toMatchObject({ updated: 1 });
    expect(summary.slots).toMatchObject({ moved: 1, created: 0, failed: 0 });
    expect(summary.items[0].slot).toBe("moved");
    expect(await slotAt(service.id, at(2))).toBeNull();
    const moved = await slotAt(service.id, at(6));
    expect(moved?.status).toBe("available");
    expect(moved?.endsAt.toISOString()).toBe(at(7).toISOString());
  });

  it("removes the free slot when the schedule is cancelled", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const seeded = await seedImportedSchedule(connection.id, { externalId: "SLOT-RM" });
    await prisma.bookingSlot.create({
      data: { serviceId: service.id, startsAt: seeded.startsAt, endsAt: seeded.endsAt, status: "available" },
    });
    const schedules = [makeValidatedSchedule({ externalId: "SLOT-RM", status: "cancelled" })];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary).toMatchObject({ cancelled: 1 });
    expect(summary.slots).toMatchObject({ removed: 1, failed: 0 });
    expect(summary.items[0].slot).toBe("removed");
    expect(await countSlots(service.id)).toBe(0);
  });

  it("keeps a booked slot when the schedule is cancelled", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const seeded = await seedImportedSchedule(connection.id, { externalId: "SLOT-BK" });
    await prisma.bookingSlot.create({
      data: { serviceId: service.id, startsAt: seeded.startsAt, endsAt: seeded.endsAt, status: "booked" },
    });
    const schedules = [makeValidatedSchedule({ externalId: "SLOT-BK", status: "cancelled" })];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary).toMatchObject({ cancelled: 1 });
    expect(summary.slots).toMatchObject({ removed: 0, kept: 1, failed: 0 });
    expect(summary.items[0].slot).toBe("kept");
    expect(summary.items[0].slotError).toMatch(/đã có khách đặt/);
    const kept = await slotAt(service.id, at(2));
    expect(kept?.status).toBe("booked");
  });

  it("keeps a booked slot and creates a new one when the schedule time moves", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const seeded = await seedImportedSchedule(connection.id, { externalId: "SLOT-BKMV" });
    await prisma.bookingSlot.create({
      data: { serviceId: service.id, startsAt: seeded.startsAt, endsAt: seeded.endsAt, status: "booked" },
    });
    const schedules = [
      makeValidatedSchedule({ externalId: "SLOT-BKMV", startsAt: at(6), endsAt: at(7) }),
    ];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary.slots).toMatchObject({ created: 1, moved: 0, failed: 0 });
    expect(summary.items[0].slot).toBe("created");
    expect(summary.items[0].slotError).toMatch(/đã có khách đặt/);
    const oldSlot = await slotAt(service.id, at(2));
    expect(oldSlot?.status).toBe("booked");
    const newSlot = await slotAt(service.id, at(6));
    expect(newSlot?.status).toBe("available");
  });

  it("adopts a manually created slot at the same time instead of duplicating it", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    await prisma.bookingSlot.create({
      data: { serviceId: service.id, startsAt: at(2), endsAt: at(3), status: "available" },
    });
    const schedules = [makeValidatedSchedule({ externalId: "SLOT-AD" })];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary.slots).toMatchObject({ created: 0, kept: 1, failed: 0 });
    expect(summary.items[0].slot).toBe("exists");
    expect(await countSlots(service.id)).toBe(1);
  });

  it("updates the slot end time when only the schedule end changes", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const seeded = await seedImportedSchedule(connection.id, { externalId: "SLOT-END" });
    await prisma.bookingSlot.create({
      data: { serviceId: service.id, startsAt: seeded.startsAt, endsAt: seeded.endsAt, status: "available" },
    });
    const schedules = [makeValidatedSchedule({ externalId: "SLOT-END", endsAt: at(4) })];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary).toMatchObject({ updated: 1 });
    expect(summary.slots).toMatchObject({ updated: 1, failed: 0 });
    expect(summary.items[0].slot).toBe("updated");
    const slot = await slotAt(service.id, at(2));
    expect(slot?.endsAt.toISOString()).toBe(at(4).toISOString());
  });

  it("imports fine with no slots when there is no active booking service", async () => {
    const { connection } = await makeTestConnection();
    const schedules = [makeValidatedSchedule({ externalId: "SLOT-NS" })];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary).toMatchObject({ created: 1 });
    expect(summary.serviceSlug).toBeNull();
    expect(summary.slots).toMatchObject({ created: 0, failed: 0 });
    expect(summary.slotsNote).toMatch(/Không có dịch vụ đặt lịch/);
    expect(await prisma.importedSchedule.count({ where: { connectionId: connection.id } })).toBe(1);
  });

  it("manual scope (connectionId null) also creates slots", async () => {
    const service = await makeActiveService();
    const schedules = [makeValidatedSchedule({ externalId: "SLOT-MAN" })];
    const { summary } = await applyScheduleImport({
      connectionId: null,
      source: "admin-manual",
      schedules,
      importKey: null,
      payloadHash: computeScheduleImportPayloadHash(schedules),
      userId: null,
    });

    expect(summary.slots).toMatchObject({ created: 1 });
    expect(await countSlots(service.id)).toBe(1);
  });

  it("replay returns the stored schedule counts plus the current slot state", async () => {
    const service = await makeActiveService();
    const { connection } = await makeTestConnection();
    const schedules: ValidatedSchedule[] = [makeValidatedSchedule({ externalId: "SLOT-RP" })];
    const input = {
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      importKey: "replay-slots-1",
      payloadHash: computeScheduleImportPayloadHash(schedules),
    };
    const first = await applyScheduleImport(input);
    expect(first.summary.slots).toMatchObject({ created: 1 });
    expect(first.summary.items[0].slot).toBe("created");

    const replay = await applyScheduleImport(input);
    expect(replay.importId).toBe(first.importId);
    expect(replay.summary).toMatchObject({
      total: first.summary.total,
      created: first.summary.created,
      updated: first.summary.updated,
      unchanged: first.summary.unchanged,
      cancelled: first.summary.cancelled,
      failed: first.summary.failed,
    });
    // The slot is already there now — the replay says so instead of
    // re-reporting the first run's "created".
    expect(replay.summary.slots).toMatchObject({ created: 0, kept: 1 });
    expect(replay.summary.items[0].slot).toBe("exists");
    expect(await countSlots(service.id)).toBe(1);
  });
});
