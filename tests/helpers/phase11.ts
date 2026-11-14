// Shared fixtures for the Phase 11 vitest suites (Worker A).
//
// DB-backed helpers only — no HTTP here. Used by the schema/engine tests
// (Worker A) and the API/concurrency tests (Workers B/F). Fixture ids are
// unique per call so files can share one test DB sequentially without
// colliding. All writes go to `portfolio_test` only (see tests/setup.ts).
import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/server/db";
import type { ValidatedSchedule } from "@/lib/schedule-import-schema";

export function uid(): string {
  return randomBytes(6).toString("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export type TestConnection = {
  connection: { id: string; name: string; tokenHash: string };
  /** The raw token whose SHA-256 is stored as `tokenHash` (never persisted raw). */
  plainToken: string;
};

/** Creates an active IntegrationConnection. Returns the row + raw token. */
export async function makeTestConnection(opts: { name?: string; autoApply?: boolean; isActive?: boolean } = {}): Promise<TestConnection> {
  const plainToken = `imp_${randomBytes(16).toString("hex")}`;
  const connection = await prisma.integrationConnection.create({
    data: {
      name: opts.name ?? `test-connection-${uid()}`,
      tokenHash: sha256Hex(plainToken),
      autoApply: opts.autoApply ?? false,
      isActive: opts.isActive ?? true,
    },
    select: { id: true, name: true, tokenHash: true },
  });
  return { connection, plainToken };
}

export type SeedScheduleOverrides = {
  externalId?: string;
  title?: string;
  description?: string;
  location?: string;
  note?: string;
  startsAt?: Date;
  endsAt?: Date;
  status?: string;
};

/** Creates one ImportedSchedule row in the given scope (null = manual scope). */
export async function seedImportedSchedule(
  connectionId: string | null,
  overrides: SeedScheduleOverrides = {},
): Promise<{
  id: string;
  connectionId: string | null;
  externalId: string;
  title: string;
  description: string;
  location: string;
  note: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
}> {
  const startsAt = overrides.startsAt ?? new Date("2026-11-20T02:00:00.000Z"); // 09:00 VN
  return prisma.importedSchedule.create({
    data: {
      connectionId,
      externalId: overrides.externalId ?? `EXT-${uid()}`,
      title: overrides.title ?? "Lịch kiểm thử",
      description: overrides.description ?? "",
      location: overrides.location ?? "",
      note: overrides.note ?? "",
      startsAt,
      endsAt: overrides.endsAt ?? new Date(startsAt.getTime() + 60 * 60_000),
      status: overrides.status ?? "scheduled",
    },
  });
}

/**
 * Builds a ValidatedSchedule (09:00–10:00 VN on 2026-11-20 by default).
 * Pure helper — no DB. `vnLocalToUtc` is reused via the schema parse path
 * in the schema tests; here the UTC values are written out directly.
 */
export function makeValidatedSchedule(overrides: Partial<ValidatedSchedule> & { externalId: string }): ValidatedSchedule {
  return {
    title: "Lịch kiểm thử",
    description: "",
    location: "",
    note: "",
    startsAt: new Date("2026-11-20T02:00:00.000Z"),
    endsAt: new Date("2026-11-20T03:00:00.000Z"),
    status: "scheduled",
    ...overrides,
  };
}

/** Empties only the Phase 11 tables (children first; Restrict-safe order). */
export async function wipeScheduleImportTables(): Promise<void> {
  await prisma.scheduleImportItem.deleteMany();
  await prisma.scheduleImport.deleteMany();
  await prisma.importedSchedule.deleteMany();
  await prisma.integrationConnection.deleteMany();
}
