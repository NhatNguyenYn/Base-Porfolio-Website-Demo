// Phase 11 — import engine tests (Worker A).
// DB-backed integration tests against `portfolio_test` only. Covers D5/D6:
// create/update/unchanged/cancelled, idempotent re-apply, importId replay +
// conflict, cross-connection isolation, missing records left alone, and
// preview writing nothing.
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import {
  applyScheduleImport,
  computeScheduleImportPayloadHash,
  ConcurrentImportError,
  ImportIdConflictError,
  IntegrationConnectionNotFoundError,
  previewScheduleImport,
} from "@/server/schedule-import/engine";
import type { ValidatedSchedule } from "@/lib/schedule-import-schema";
import {
  makeTestConnection,
  makeValidatedSchedule,
  seedImportedSchedule,
  wipeScheduleImportTables,
} from "./helpers/phase11";

const SOURCE = "external_agent";

async function countSchedules(connectionId?: string | null): Promise<number> {
  return prisma.importedSchedule.count({
    where: connectionId === undefined ? {} : { connectionId },
  });
}

describe("schedule import engine", () => {
  beforeEach(async () => {
    await wipeScheduleImportTables();
  });

  it("creates new schedules and records the import", async () => {
    const { connection } = await makeTestConnection();
    const schedules = [
      makeValidatedSchedule({ externalId: "EXT-1", title: "Hẹn 1" }),
      makeValidatedSchedule({ externalId: "EXT-2", title: "Hẹn 2", status: "confirmed" }),
    ];
    const { importId, summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary).toMatchObject({ total: 2, created: 2, updated: 0, unchanged: 0, cancelled: 0, failed: 0 });
    expect(summary.items.map((item) => item.action)).toEqual(["created", "created"]);
    expect(await countSchedules(connection.id)).toBe(2);

    const record = await prisma.scheduleImport.findUnique({ where: { id: importId }, include: { items: true } });
    expect(record?.status).toBe("completed");
    expect(record?.totalRecords).toBe(2);
    expect(record?.createdCount).toBe(2);
    expect(record?.connectionId).toBe(connection.id);
    expect(record?.items).toHaveLength(2);
  });

  it("updates a changed schedule and leaves an identical one unchanged", async () => {
    const { connection } = await makeTestConnection();
    await seedImportedSchedule(connection.id, { externalId: "EXT-1", title: "Tiêu đề cũ" });
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-2",
      title: "Giữ nguyên",
      startsAt: new Date("2026-11-20T02:00:00.000Z"),
      endsAt: new Date("2026-11-20T03:00:00.000Z"),
    });
    const schedules = [
      makeValidatedSchedule({ externalId: "EXT-1", title: "Tiêu đề mới" }),
      makeValidatedSchedule({ externalId: "EXT-2", title: "Giữ nguyên" }),
    ];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });

    expect(summary).toMatchObject({ total: 2, created: 0, updated: 1, unchanged: 1 });
    const updated = await prisma.importedSchedule.findFirst({ where: { connectionId: connection.id, externalId: "EXT-1" } });
    expect(updated?.title).toBe("Tiêu đề mới");
    expect(await countSchedules(connection.id)).toBe(2);
  });

  it("marks an existing schedule cancelled (and a repeat apply is unchanged)", async () => {
    const { connection } = await makeTestConnection();
    await seedImportedSchedule(connection.id, { externalId: "EXT-1", status: "scheduled" });
    const schedules = [makeValidatedSchedule({ externalId: "EXT-1", status: "cancelled" })];

    const first = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });
    expect(first.summary).toMatchObject({ total: 1, created: 0, cancelled: 1 });
    const row = await prisma.importedSchedule.findFirst({ where: { connectionId: connection.id, externalId: "EXT-1" } });
    expect(row?.status).toBe("cancelled");

    const second = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });
    expect(second.summary).toMatchObject({ total: 1, unchanged: 1, cancelled: 0 });
  });

  it("creates a not-yet-existing cancelled id as cancelled, counted as created", async () => {
    const { connection } = await makeTestConnection();
    const schedules = [makeValidatedSchedule({ externalId: "EXT-NEW", status: "cancelled" })];
    const { summary } = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });
    expect(summary).toMatchObject({ total: 1, created: 1, cancelled: 0 });
    const row = await prisma.importedSchedule.findFirst({ where: { connectionId: connection.id, externalId: "EXT-NEW" } });
    expect(row?.status).toBe("cancelled");
  });

  it("re-applying the same payload without importId is fully unchanged and creates no duplicate rows", async () => {
    const { connection } = await makeTestConnection();
    const schedules = [makeValidatedSchedule({ externalId: "EXT-1" })];
    const hash = computeScheduleImportPayloadHash(schedules);
    await applyScheduleImport({ connectionId: connection.id, source: SOURCE, schedules, payloadHash: hash });
    const second = await applyScheduleImport({ connectionId: connection.id, source: SOURCE, schedules, payloadHash: hash });
    expect(second.summary).toMatchObject({ total: 1, unchanged: 1, created: 0 });
    expect(await countSchedules(connection.id)).toBe(1);
  });

  it("replays an identical importId + payloadHash without re-applying", async () => {
    const { connection } = await makeTestConnection();
    const schedules = [makeValidatedSchedule({ externalId: "EXT-1", title: "Hẹn 1" })];
    const hash = computeScheduleImportPayloadHash(schedules);
    const first = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      importKey: "key-1",
      payloadHash: hash,
    });
    const replay = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      importKey: "key-1",
      payloadHash: hash,
    });
    expect(replay.importId).toBe(first.importId);
    expect(replay.summary).toEqual(first.summary);
    expect(await prisma.scheduleImport.count()).toBe(1);
    expect(await countSchedules(connection.id)).toBe(1);
  });

  it("rejects the same importId with a different payloadHash", async () => {
    const { connection } = await makeTestConnection();
    const schedules = [makeValidatedSchedule({ externalId: "EXT-1", title: "Hẹn 1" })];
    await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      importKey: "key-1",
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });
    const changed = [makeValidatedSchedule({ externalId: "EXT-1", title: "Tiêu đề khác" })];
    await expect(
      applyScheduleImport({
        connectionId: connection.id,
        source: SOURCE,
        schedules: changed,
        importKey: "key-1",
        payloadHash: computeScheduleImportPayloadHash(changed),
      }),
    ).rejects.toBeInstanceOf(ImportIdConflictError);
    // The conflicting attempt wrote nothing: still one import, title unchanged.
    expect(await prisma.scheduleImport.count()).toBe(1);
    const row = await prisma.importedSchedule.findFirst({ where: { connectionId: connection.id, externalId: "EXT-1" } });
    expect(row?.title).toBe("Hẹn 1");
  });

  it("isolates connections: another connection's id fails, the rest still apply", async () => {
    const a = await makeTestConnection({ name: "conn-a" });
    const b = await makeTestConnection({ name: "conn-b" });
    await seedImportedSchedule(a.connection.id, { externalId: "EXT-SHARED", title: "Của A" });
    const schedules = [
      makeValidatedSchedule({ externalId: "EXT-SHARED", title: "Của B?" }),
      makeValidatedSchedule({ externalId: "EXT-NEW-B", title: "Mới của B" }),
    ];
    const { summary } = await applyScheduleImport({
      connectionId: b.connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });
    expect(summary).toMatchObject({ total: 2, created: 1, failed: 1 });
    expect(summary.items.find((item) => item.externalId === "EXT-SHARED")).toMatchObject({
      action: "failed",
      error: "already owned by another connection",
    });
    const record = await prisma.scheduleImport.findFirst({ where: { connectionId: b.connection.id } });
    expect(record?.status).toBe("completed_with_errors");
    expect(record?.failedCount).toBe(1);
    // A's row is untouched and B owns only the new row.
    const aRow = await prisma.importedSchedule.findFirst({ where: { connectionId: a.connection.id, externalId: "EXT-SHARED" } });
    expect(aRow?.title).toBe("Của A");
    expect(await countSchedules(b.connection.id)).toBe(1);
  });

  it("keeps manual (null) and API scopes apart in both directions", async () => {
    const { connection } = await makeTestConnection();
    await seedImportedSchedule(null, { externalId: "EXT-MANUAL", title: "Thủ công" });

    // API import of the manual id must fail (collision), not match it.
    const api = await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules: [makeValidatedSchedule({ externalId: "EXT-MANUAL", title: "API?" })],
      payloadHash: computeScheduleImportPayloadHash([makeValidatedSchedule({ externalId: "EXT-MANUAL", title: "API?" })]),
    });
    expect(api.summary).toMatchObject({ total: 1, failed: 1 });

    // Manual import of the same id matches the manual row.
    const manual = await applyScheduleImport({
      connectionId: null,
      source: "admin-manual",
      schedules: [makeValidatedSchedule({ externalId: "EXT-MANUAL", title: "Thủ công" })],
      payloadHash: computeScheduleImportPayloadHash([makeValidatedSchedule({ externalId: "EXT-MANUAL", title: "Thủ công" })]),
    });
    expect(manual.summary).toMatchObject({ total: 1, unchanged: 1 });
  });

  it("does not delete records missing from the payload", async () => {
    const { connection } = await makeTestConnection();
    await seedImportedSchedule(connection.id, { externalId: "EXT-KEEP", title: "Giữ lại" });
    const schedules = [makeValidatedSchedule({ externalId: "EXT-1" })];
    await applyScheduleImport({
      connectionId: connection.id,
      source: SOURCE,
      schedules,
      payloadHash: computeScheduleImportPayloadHash(schedules),
    });
    expect(await countSchedules(connection.id)).toBe(2);
    const kept = await prisma.importedSchedule.findFirst({ where: { connectionId: connection.id, externalId: "EXT-KEEP" } });
    expect(kept?.title).toBe("Giữ lại");
  });

  it("preview reports counts without writing anything", async () => {
    const { connection } = await makeTestConnection();
    await seedImportedSchedule(connection.id, { externalId: "EXT-1", title: "Tiêu đề cũ" });
    await seedImportedSchedule(connection.id, { externalId: "EXT-2", status: "scheduled" });
    const schedules: ValidatedSchedule[] = [
      makeValidatedSchedule({ externalId: "EXT-1", title: "Tiêu đề mới" }),
      makeValidatedSchedule({ externalId: "EXT-2", status: "cancelled" }),
      makeValidatedSchedule({ externalId: "EXT-3" }),
    ];
    const summary = await previewScheduleImport({ connectionId: connection.id, source: SOURCE, schedules });
    expect(summary).toMatchObject({ total: 3, created: 1, updated: 1, cancelled: 1, unchanged: 0, failed: 0 });
    expect(await countSchedules(connection.id)).toBe(2);
    expect(await prisma.scheduleImport.count()).toBe(0);
    expect(await prisma.scheduleImportItem.count()).toBe(0);
  });

  it("preview flags a cross-connection id as failed", async () => {
    const a = await makeTestConnection({ name: "conn-a" });
    const b = await makeTestConnection({ name: "conn-b" });
    await seedImportedSchedule(a.connection.id, { externalId: "EXT-SHARED" });
    const summary = await previewScheduleImport({
      connectionId: b.connection.id,
      source: SOURCE,
      schedules: [makeValidatedSchedule({ externalId: "EXT-SHARED" })],
    });
    expect(summary).toMatchObject({ total: 1, failed: 1 });
    expect(summary.items[0]).toMatchObject({ action: "failed", error: "already owned by another connection" });
    expect(await countSchedules(b.connection.id)).toBe(0);
  });

  it("rejects apply for an unknown connection id", async () => {
    const schedules = [makeValidatedSchedule({ externalId: "EXT-1" })];
    await expect(
      applyScheduleImport({
        connectionId: "does-not-exist",
        source: SOURCE,
        schedules,
        payloadHash: computeScheduleImportPayloadHash(schedules),
      }),
    ).rejects.toBeInstanceOf(IntegrationConnectionNotFoundError);
    expect(await prisma.scheduleImport.count()).toBe(0);
  });

  it("computes a stable payload hash regardless of schedule order", () => {
    const a = makeValidatedSchedule({ externalId: "EXT-1" });
    const b = makeValidatedSchedule({ externalId: "EXT-2" });
    expect(computeScheduleImportPayloadHash([a, b])).toBe(computeScheduleImportPayloadHash([b, a]));
    expect(computeScheduleImportPayloadHash([a, b])).not.toBe(
      computeScheduleImportPayloadHash([{ ...a, title: "Khác" }, b]),
    );
  });

  it("exports the concurrency error type for the route's 409 mapping", () => {
    expect(new ConcurrentImportError().name).toBe("ConcurrentImportError");
  });
});
