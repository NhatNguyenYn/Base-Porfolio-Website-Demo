// Phase 11 — Worker C: manual-import parse helper + admin queries (D8/D10).
//
// DB-backed query tests run against `portfolio_test` only (see tests/setup.ts).
// Covers: friendly errors for malformed/oversize/invalid JSON, valid
// envelope -> UTC ValidatedSchedule rows, history list filters + pagination,
// detail lookup, and the month calendar's VN boundaries + status filter.
import { beforeEach, describe, expect, it } from "vitest";

import { parseManualImportJson } from "@/lib/schedule-import-manual";
import {
  getScheduleImportDetail,
  listImportedSchedulesForCalendar,
  listIntegrationConnections,
  listScheduleImports,
} from "@/server/queries/schedule-import";
import { prisma } from "@/server/db";
import { makeTestConnection, seedImportedSchedule, wipeScheduleImportTables } from "./helpers/phase11";

function envelope(schedules: unknown[]): Record<string, unknown> {
  return {
    type: "schedule_import",
    version: "1.0",
    source: "external_agent",
    generatedAt: "2026-11-14T10:30:00+07:00",
    schedules,
  };
}

function schedule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "EXT-001",
    title: "Tư vấn khách hàng",
    date: "2026-11-20",
    start: "09:00",
    end: "10:00",
    status: "confirmed",
    ...overrides,
  };
}

describe("parseManualImportJson", () => {
  it("rejects malformed JSON with a friendly message and no stack trace", () => {
    const result = parseManualImportJson("{not json");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.message).toMatch(/JSON không hợp lệ/);
    expect(result.message).not.toMatch(/SyntaxError|at\s+\w+\s+\(/);
  });

  it("rejects an oversize payload", () => {
    const big = JSON.stringify(envelope([schedule({ title: "x".repeat(300_000) })]));
    const result = parseManualImportJson(big);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.message).toMatch(/256 KB/);
  });

  it("rejects duplicate ids and names them", () => {
    const result = parseManualImportJson(JSON.stringify(envelope([schedule(), schedule()])));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.message).toMatch(/EXT-001/);
    expect(result.fieldErrors?.schedules?.join(" ")).toMatch(/EXT-001/);
  });

  it("rejects an impossible date and end <= start", () => {
    const badDate = parseManualImportJson(JSON.stringify(envelope([schedule({ date: "2026-02-30" })])));
    expect(badDate.ok).toBe(false);
    const badEnd = parseManualImportJson(JSON.stringify(envelope([schedule({ start: "10:00", end: "09:00" })])));
    expect(badEnd.ok).toBe(false);
    if (!badEnd.ok) expect(badEnd.message).toMatch(/sau giờ bắt đầu|End time must be after/);
  });

  it("parses a valid envelope and converts VN wall-clock to UTC", () => {
    const result = parseManualImportJson(JSON.stringify(envelope([schedule()])));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.envelope.source).toBe("external_agent");
    expect(result.schedules).toHaveLength(1);
    // 09:00 VN = 02:00 UTC; 10:00 VN = 03:00 UTC.
    expect(result.schedules[0].startsAt.toISOString()).toBe("2026-11-20T02:00:00.000Z");
    expect(result.schedules[0].endsAt.toISOString()).toBe("2026-11-20T03:00:00.000Z");
    expect(result.schedules[0].status).toBe("confirmed");
    expect(result.schedules[0].externalId).toBe("EXT-001");
  });
});

describe("admin schedule-import queries", () => {
  beforeEach(async () => {
    await wipeScheduleImportTables();
  });

  async function seedImport(overrides: {
    source?: string;
    status?: string;
    createdCount?: number;
    items?: { externalId: string; action: string; error?: string }[];
  } = {}) {
    return prisma.scheduleImport.create({
      data: {
        source: overrides.source ?? "admin-manual",
        status: overrides.status ?? "completed",
        totalRecords: overrides.items?.length ?? 1,
        createdCount: overrides.createdCount ?? 1,
        updatedCount: 0,
        unchangedCount: 0,
        cancelledCount: 0,
        failedCount: 0,
        items: {
          create: overrides.items ?? [{ externalId: "EXT-001", action: "created" }],
        },
      },
      select: { id: true },
    });
  }

  it("lists connections with counts and newest first", async () => {
    const { connection } = await makeTestConnection({ name: "conn-a" });
    await seedImportedSchedule(connection.id, { externalId: "EXT-A" });
    const rows = await listIntegrationConnections();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("conn-a");
    expect(rows[0].isActive).toBe(true);
    expect(rows[0].scheduleCount).toBe(1);
    expect(rows[0].importCount).toBe(0);
  });

  it("lists history with source/status filters and pagination", async () => {
    await seedImport({ source: "admin-manual", status: "completed" });
    await seedImport({ source: "external_agent", status: "completed_with_errors", createdCount: 0 });
    await seedImport({ source: "external_agent", status: "failed", createdCount: 0 });

    const all = await listScheduleImports({});
    expect(all.total).toBe(3);
    expect(all.items).toHaveLength(3);

    const manual = await listScheduleImports({ source: "admin-manual" });
    expect(manual.total).toBe(1);
    expect(manual.items[0].source).toBe("admin-manual");

    const failed = await listScheduleImports({ status: "failed" });
    expect(failed.total).toBe(1);
    expect(failed.items[0].status).toBe("failed");

    const page2 = await listScheduleImports({ perPage: 2, page: 2 });
    expect(page2.total).toBe(3);
    expect(page2.items).toHaveLength(1);
  });

  it("returns import detail with items, or null for an unknown id", async () => {
    const { id } = await seedImport({
      items: [
        { externalId: "EXT-001", action: "created" },
        { externalId: "EXT-002", action: "failed", error: "already owned by another connection" },
      ],
    });
    const detail = await getScheduleImportDetail(id);
    expect(detail).not.toBeNull();
    expect(detail?.totalRecords).toBe(2);
    expect(detail?.items.map((item) => item.externalId)).toEqual(["EXT-001", "EXT-002"]);
    expect(detail?.items[1].error).toBe("already owned by another connection");
    expect(await getScheduleImportDetail("no-such-id")).toBeNull();
  });

  it("calendar returns only the requested VN month, ordered by start", async () => {
    const { connection } = await makeTestConnection();
    // 09:00 VN 20/11 = 02:00Z; 09:00 VN 01/12 = 02:00Z Dec 1.
    const inMonth = await seedImportedSchedule(connection.id, {
      externalId: "EXT-NOV-20",
      startsAt: new Date("2026-11-20T02:00:00.000Z"),
      endsAt: new Date("2026-11-20T03:00:00.000Z"),
    });
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-DEC-01",
      startsAt: new Date("2026-12-01T02:00:00.000Z"),
      endsAt: new Date("2026-12-01T03:00:00.000Z"),
    });
    const rows = await listImportedSchedulesForCalendar({ month: "2026-11" });
    expect(rows.map((row) => row.externalId)).toEqual(["EXT-NOV-20"]);
    expect(rows[0].id).toBe(inMonth.id);
  });

  it("calendar honours a single-day filter and a status filter", async () => {
    const { connection } = await makeTestConnection();
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-DAY-1",
      startsAt: new Date("2026-11-20T02:00:00.000Z"),
      endsAt: new Date("2026-11-20T03:00:00.000Z"),
      status: "scheduled",
    });
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-DAY-2",
      startsAt: new Date("2026-11-21T02:00:00.000Z"),
      endsAt: new Date("2026-11-21T03:00:00.000Z"),
      status: "cancelled",
    });

    const day = await listImportedSchedulesForCalendar({ month: "2026-11", date: "2026-11-20" });
    expect(day.map((row) => row.externalId)).toEqual(["EXT-DAY-1"]);

    const cancelled = await listImportedSchedulesForCalendar({ month: "2026-11", status: "cancelled" });
    expect(cancelled.map((row) => row.externalId)).toEqual(["EXT-DAY-2"]);
  });
});
