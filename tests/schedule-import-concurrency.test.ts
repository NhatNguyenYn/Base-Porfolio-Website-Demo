// Phase 11 — concurrency + rollback tests (Worker F, D5/D6).
//
// DB-backed integration tests against `portfolio_test` only. Two
// `applyScheduleImport` calls racing on the same connection must never
// create duplicate ImportedSchedule rows: the `@@unique([connectionId,
// externalId])` backstop turns the loser into a 409 CONCURRENT_IMPORT
// (or, when the loser starts after the winner committed, into an
// idempotent replay), and a lost race rolls the loser's whole transaction
// back — no partial rows are left behind, and re-sending the loser's
// payload afterwards succeeds (retry is safe).
//
// The race in test (b) is timing-dependent by nature: if both transactions
// happen to run sequentially (no overlap), both succeed with a last-writer
// merge and no 409 is observed. The test therefore retries the scenario
// with fresh ids (up to MAX_RACE_ATTEMPTS) until a real 409 is observed,
// and only then asserts the rollback/retry invariants. If no 409 is
// observed after all attempts the test FAILS loudly instead of passing on
// a sequential run — a concurrency test that never raced proves nothing.
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import type { ValidatedSchedule } from "@/lib/schedule-import-schema";
import {
  applyScheduleImport,
  computeScheduleImportPayloadHash,
  ConcurrentImportError,
  type ImportSummary,
} from "@/server/schedule-import/engine";
import {
  makeTestConnection,
  makeValidatedSchedule,
  uid,
  wipeScheduleImportTables,
} from "./helpers/phase11";

const MAX_RACE_ATTEMPTS = 8;
/** Rows per racing payload (shared id first, then fillers) — large enough
 *  that each transaction lives long enough for the other to overlap it. */
const RACE_PAYLOAD_ROWS = 20;

function buildSchedules(
  prefix: string,
  count: number,
  title: string,
): ValidatedSchedule[] {
  return Array.from({ length: count }, (_, i) =>
    makeValidatedSchedule({
      externalId: `${prefix}-${i}`,
      title: `${title} ${i}`,
    }),
  );
}

async function applyPayload(
  connectionId: string,
  schedules: ValidatedSchedule[],
  importKey: string,
) {
  return applyScheduleImport({
    connectionId,
    source: "concurrency-test",
    schedules,
    importKey,
    payloadHash: computeScheduleImportPayloadHash(schedules),
    userId: null,
  });
}

type SettledApply = PromiseSettledResult<{ importId: string; summary: ImportSummary }>;

function expectConcurrentOrSuccess(result: SettledApply): void {
  if (result.status === "rejected") {
    expect(result.reason).toBeInstanceOf(ConcurrentImportError);
  }
}

beforeEach(async () => {
  await wipeScheduleImportTables();
});

describe("schedule import concurrency (D5/D6)", () => {
  it("(a) two identical concurrent applies create no duplicates", async () => {
    const { connection } = await makeTestConnection();
    const run = uid();
    const schedules = buildSchedules(`EXT-CONC-A-${run}`, 10, "Đồng thời A");
    const importKey = `conc-identical-${run}`;

    const [first, second] = await Promise.allSettled([
      applyPayload(connection.id, schedules, importKey),
      applyPayload(connection.id, schedules, importKey),
    ]);
    expectConcurrentOrSuccess(first);
    expectConcurrentOrSuccess(second);
    // At least one side must have applied (a double 409 is impossible:
    // the first transaction to commit leaves a replayable import row).
    expect(first.status === "fulfilled" || second.status === "fulfilled").toBe(true);

    const fulfilled = [first, second].filter(
      (r): r is PromiseFulfilledResult<{ importId: string; summary: ImportSummary }> =>
        r.status === "fulfilled",
    );
    if (fulfilled.length === 2) {
      // Both saw the same stored import (replay): same row, same summary.
      expect(fulfilled[0].value.importId).toBe(fulfilled[1].value.importId);
      expect(fulfilled[0].value.summary).toEqual(fulfilled[1].value.summary);
    }
    for (const result of fulfilled) {
      expect(result.value.summary).toMatchObject({ total: 10, created: 10, failed: 0 });
    }

    // Exactly the 10 distinct rows — no duplicates — and one import row.
    expect(
      await prisma.importedSchedule.count({ where: { connectionId: connection.id } }),
    ).toBe(10);
    const rows = await prisma.importedSchedule.findMany({
      where: { connectionId: connection.id },
      select: { externalId: true },
    });
    expect(new Set(rows.map((row) => row.externalId)).size).toBe(10);
    expect(await prisma.scheduleImport.count({ where: { connectionId: connection.id } })).toBe(1);
  });

  it("(b+c) overlapping concurrent payloads: loser rolls back fully, retry succeeds", async () => {
    let raceObserved = false;
    let attempts = 0;

    for (let attempt = 0; attempt < MAX_RACE_ATTEMPTS && !raceObserved; attempt++) {
      attempts = attempt + 1;
      await wipeScheduleImportTables();
      const { connection } = await makeTestConnection();
      const run = uid();
      const sharedId = `EXT-CONC-SHARED-${run}`;
      const winnerTitle = `Tiêu đề X ${run}`;
      const loserTitle = `Tiêu đề Y ${run}`;

      const payloadX: ValidatedSchedule[] = [
        makeValidatedSchedule({ externalId: sharedId, title: winnerTitle }),
        ...buildSchedules(`EXT-CONC-X-${run}`, RACE_PAYLOAD_ROWS - 1, "Payload X"),
      ];
      const payloadY: ValidatedSchedule[] = [
        makeValidatedSchedule({ externalId: sharedId, title: loserTitle }),
        ...buildSchedules(`EXT-CONC-Y-${run}`, RACE_PAYLOAD_ROWS - 1, "Payload Y"),
      ];

      const [resultX, resultY] = await Promise.allSettled([
        applyPayload(connection.id, payloadX, `conc-race-x-${run}`),
        applyPayload(connection.id, payloadY, `conc-race-y-${run}`),
      ]);

      const fulfilled = [resultX, resultY].filter((r) => r.status === "fulfilled");
      const rejected = [resultX, resultY].filter((r) => r.status === "rejected");
      if (fulfilled.length !== 1 || rejected.length !== 1) {
        // Sequential run (both succeeded, last writer won) — no race to
        // verify; retry with fresh ids.
        continue;
      }
      expect(rejected[0]).toMatchObject({ status: "rejected" });
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConcurrentImportError);
      raceObserved = true;

      const winnerIsX = resultX.status === "fulfilled";
      const winnerPayload = winnerIsX ? payloadX : payloadY;
      const loserPayload = winnerIsX ? payloadY : payloadX;
      const winnerTitleExpected = winnerIsX ? winnerTitle : loserTitle;
      const loserTitleExpected = winnerIsX ? loserTitle : winnerTitle;

      // (b) ROLLBACK: the loser's whole transaction is gone — none of its
      // unique rows exist, and the shared row holds the WINNER's data only.
      const sharedRow = await prisma.importedSchedule.findFirstOrThrow({
        where: { externalId: sharedId },
      });
      expect(sharedRow.title).toBe(winnerTitleExpected);
      expect(sharedRow.connectionId).toBe(connection.id);
      expect(
        await prisma.importedSchedule.count({
          where: {
            connectionId: connection.id,
            externalId: { in: loserPayload.slice(1).map((s) => s.externalId) },
          },
        }),
      ).toBe(0);
      expect(
        await prisma.importedSchedule.count({ where: { connectionId: connection.id } }),
      ).toBe(RACE_PAYLOAD_ROWS);
      // Only the winner's import row exists.
      expect(await prisma.scheduleImport.count({ where: { connectionId: connection.id } })).toBe(1);
      const winnerImport = await prisma.scheduleImport.findFirstOrThrow({
        where: { connectionId: connection.id },
      });
      expect(winnerImport.status).toBe("completed");
      expect(winnerImport.createdCount).toBe(RACE_PAYLOAD_ROWS);

      // (c) RETRY: re-sending the loser's payload now succeeds — the shared
      // row is updated to the loser's title and the loser's own rows are
      // created. The retry is safe because apply is record-idempotent.
      const loserKey = winnerIsX ? `conc-race-y-${run}` : `conc-race-x-${run}`;
      const retry = await applyPayload(connection.id, loserPayload, loserKey);
      expect(retry.summary).toMatchObject({
        total: RACE_PAYLOAD_ROWS,
        created: RACE_PAYLOAD_ROWS - 1,
        updated: 1,
        failed: 0,
      });
      expect(
        (await prisma.importedSchedule.findFirstOrThrow({ where: { externalId: sharedId } })).title,
      ).toBe(loserTitleExpected);
      expect(
        await prisma.importedSchedule.count({ where: { connectionId: connection.id } }),
      ).toBe(2 * RACE_PAYLOAD_ROWS - 1);
      expect(
        await prisma.importedSchedule.count({
          where: {
            connectionId: connection.id,
            externalId: { in: loserPayload.slice(1).map((s) => s.externalId) },
          },
        }),
      ).toBe(RACE_PAYLOAD_ROWS - 1);
      // Winner-only data check: the winner's filler rows are untouched.
      expect(
        await prisma.importedSchedule.count({
          where: {
            connectionId: connection.id,
            externalId: { in: winnerPayload.slice(1).map((s) => s.externalId) },
          },
        }),
      ).toBe(RACE_PAYLOAD_ROWS - 1);
    }

    expect(
      raceObserved,
      `no concurrent conflict (409 CONCURRENT_IMPORT) observed in ${attempts} attempt(s) — the race never manifested, so rollback could not be verified`,
    ).toBe(true);
  });
});
