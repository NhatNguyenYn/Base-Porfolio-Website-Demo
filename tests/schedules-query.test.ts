// Phase 11 — Worker D: public upcoming imported schedules query (D9).
// DB-backed integration tests against `portfolio_test` only.
// Covers: upcoming filter (status + startsAt >= now), ordering, limit,
// from/to window, and the public-scope rule — schedules from DIFFERENT
// connections (and the manual-admin scope, connectionId null) appear
// together in this public list, with no connection attribution.
import { beforeEach, describe, expect, it } from "vitest";

import { listUpcomingImportedSchedules } from "@/server/queries/schedules";
import { makeTestConnection, seedImportedSchedule, wipeScheduleImportTables } from "./helpers/phase11";

const HOUR = 60 * 60_000;

function at(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * HOUR);
}

describe("listUpcomingImportedSchedules", () => {
  beforeEach(async () => {
    await wipeScheduleImportTables();
  });

  it("returns only upcoming scheduled/confirmed schedules, soonest first", async () => {
    const { connection } = await makeTestConnection();
    const later = await seedImportedSchedule(connection.id, {
      externalId: "EXT-LATER",
      title: "Muộn hơn",
      startsAt: at(5),
      endsAt: at(6),
      status: "confirmed",
    });
    const sooner = await seedImportedSchedule(connection.id, {
      externalId: "EXT-SOONER",
      title: "Sớm hơn",
      startsAt: at(2),
      endsAt: at(3),
      status: "scheduled",
    });
    // Excluded: past, cancelled, completed.
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-PAST",
      title: "Đã qua",
      startsAt: at(-2),
      endsAt: at(-1),
      status: "scheduled",
    });
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-CANCELLED",
      title: "Đã huỷ",
      startsAt: at(3),
      endsAt: at(4),
      status: "cancelled",
    });
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-COMPLETED",
      title: "Đã xong",
      startsAt: at(4),
      endsAt: at(5),
      status: "completed",
    });

    const rows = await listUpcomingImportedSchedules();
    expect(rows.map((row) => row.id)).toEqual([sooner.id, later.id]);
    expect(rows[0]).toMatchObject({
      externalId: "EXT-SOONER",
      title: "Sớm hơn",
      status: "scheduled",
      startsAt: sooner.startsAt,
      endsAt: sooner.endsAt,
    });
    expect(rows[1]).toMatchObject({ externalId: "EXT-LATER", status: "confirmed" });
  });

  it("shows schedules from different connections together (public list, no attribution)", async () => {
    const a = await makeTestConnection();
    const b = await makeTestConnection();
    // Same externalId under two connections: two separate rows, both public.
    const fromA = await seedImportedSchedule(a.connection.id, {
      externalId: "EXT-SHARED",
      title: "Lịch của A",
      startsAt: at(2),
      endsAt: at(3),
    });
    const fromB = await seedImportedSchedule(b.connection.id, {
      externalId: "EXT-SHARED",
      title: "Lịch của B",
      startsAt: at(3),
      endsAt: at(4),
    });
    // Manual-admin scope (connectionId null) is public too.
    const manual = await seedImportedSchedule(null, {
      externalId: "EXT-MANUAL",
      title: "Lịch nhập tay",
      startsAt: at(4),
      endsAt: at(5),
    });

    const rows = await listUpcomingImportedSchedules();
    expect(rows.map((row) => row.id)).toEqual([fromA.id, fromB.id, manual.id]);
    expect(rows.map((row) => row.title)).toEqual(["Lịch của A", "Lịch của B", "Lịch nhập tay"]);
  });

  it("respects an explicit limit and defaults to 20", async () => {
    const { connection } = await makeTestConnection();
    for (let i = 0; i < 3; i++) {
      await seedImportedSchedule(connection.id, {
        externalId: `EXT-${i}`,
        title: `Lịch ${i}`,
        startsAt: at(i + 1),
        endsAt: at(i + 2),
      });
    }
    expect((await listUpcomingImportedSchedules({ limit: 2 })).map((row) => row.externalId)).toEqual([
      "EXT-0",
      "EXT-1",
    ]);

    // Default limit: seed 21 upcoming rows, expect exactly 20 back.
    await wipeScheduleImportTables();
    const { connection: conn2 } = await makeTestConnection();
    for (let i = 0; i < 21; i++) {
      await seedImportedSchedule(conn2.id, {
        externalId: `EXT-D-${i}`,
        title: `Lịch ${i}`,
        startsAt: at(i + 1),
        endsAt: at(i + 2),
      });
    }
    const rows = await listUpcomingImportedSchedules();
    expect(rows).toHaveLength(20);
    expect(rows[0]?.externalId).toBe("EXT-D-0");
    expect(rows[19]?.externalId).toBe("EXT-D-19");
  });

  it("applies the from/to window, and a past `from` still excludes past schedules", async () => {
    const { connection } = await makeTestConnection();
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-PAST",
      title: "Đã qua",
      startsAt: at(-2),
      endsAt: at(-1),
    });
    const inside = await seedImportedSchedule(connection.id, {
      externalId: "EXT-IN",
      title: "Trong khoảng",
      startsAt: at(3),
      endsAt: at(4),
    });
    await seedImportedSchedule(connection.id, {
      externalId: "EXT-OUT",
      title: "Ngoài khoảng",
      startsAt: at(9),
      endsAt: at(10),
    });

    // Window [now+1h, now+6h]: only EXT-IN.
    expect(
      (await listUpcomingImportedSchedules({ from: at(1), to: at(6) })).map((row) => row.id),
    ).toEqual([inside.id]);

    // `from` in the past must NOT resurrect past schedules (upcoming-only).
    const withPastFrom = await listUpcomingImportedSchedules({ from: at(-24) });
    expect(withPastFrom.map((row) => row.externalId)).toEqual(["EXT-IN", "EXT-OUT"]);
  });

  it("returns an empty list when there is nothing upcoming", async () => {
    expect(await listUpcomingImportedSchedules()).toEqual([]);
  });
});
