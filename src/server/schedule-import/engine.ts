// Schedule import engine (Phase 11, D5/D6).
//
// Matching is scoped to `connectionId`: `null` is the manual-admin scope and
// never matches an API connection's rows (and vice versa). An `externalId`
// owned by a DIFFERENT connection is a per-item failure ("already owned by
// another connection"); the rest of the import still applies and the import
// commits as `completed_with_errors`.
//
// Rules (D5):
// - New id -> create. Payload status `cancelled` for an id that does not
//   exist yet still CREATES the row (as cancelled) so later updates can find
//   it — it counts as `created`, NOT `cancelled`. This is deliberate and
//   documented; a `cancelled` count only ever means "an existing row was
//   newly marked cancelled".
// - Existing id + meaningful fields changed -> update (only
//   title/description/location/note/startsAt/endsAt/status are ever written).
// - Existing id + nothing changed -> `unchanged`.
// - Records missing from a payload are left alone — never deleted.
// - A whole-request schema failure writes nothing (validation happens before
//   this engine is called); an unexpected DB error inside the transaction
//   rolls the whole import back.
// - Preview performs NO writes and creates NO ScheduleImport row.
//
// Idempotency (D6): with an `importId`, a replay of the same payloadHash
// returns the stored summary without re-applying; the same importKey with a
// different payloadHash throws `ImportIdConflictError` (route -> 409
// IMPORT_ID_CONFLICT). Concurrency backstop is the DB unique index
// (@@unique([connectionId, externalId]) plus the partial manual-scope index
// in the migration); a P2002 inside apply surfaces as
// `ConcurrentImportError` (route -> 409 CONCURRENT_IMPORT) and the client
// retries — retry is safe because apply is record-idempotent.
//
// `payloadHash` is the sha256 of the canonical JSON of the validated
// schedules sorted by externalId. Callers must compute it with
// `computeScheduleImportPayloadHash` and pass it in; an empty value is
// computed here as a fallback. The engine compares/stores the hash it is
// given, so the route and the engine must agree on the canonical form —
// that is why the helper is exported instead of inlined in the route.

import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import type { ImportedScheduleStatus, ValidatedSchedule } from "@/lib/schedule-import-schema";

export type { ImportedScheduleStatus, ValidatedSchedule } from "@/lib/schedule-import-schema";

export type ImportAction = "created" | "updated" | "unchanged" | "cancelled" | "failed";

export type ImportItemResult = { externalId: string; action: ImportAction; error?: string };

export type ImportSummary = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  cancelled: number;
  failed: number;
  items: ImportItemResult[];
};

/** Same importKey reused with different content (route -> 409 IMPORT_ID_CONFLICT). */
export class ImportIdConflictError extends Error {
  readonly importKey: string;

  constructor(importKey: string) {
    super(`importId "${importKey}" was already used with different content`);
    this.name = "ImportIdConflictError";
    this.importKey = importKey;
  }
}

/** Unique-violation inside apply: a concurrent import won the race (route -> 409 CONCURRENT_IMPORT). */
export class ConcurrentImportError extends Error {
  constructor() {
    super("Concurrent import conflict — retry the import");
    this.name = "ConcurrentImportError";
  }
}

/** Apply referenced a connection id that does not exist. Callers normally validate first. */
export class IntegrationConnectionNotFoundError extends Error {
  readonly connectionId: string;

  constructor(connectionId: string) {
    super(`Integration connection not found: ${connectionId}`);
    this.name = "IntegrationConnectionNotFoundError";
    this.connectionId = connectionId;
  }
}

/**
 * Canonical payload hash (D6): sha256 of the JSON of the validated
 * schedules sorted by externalId, with UTC instants as ISO strings.
 */
export function computeScheduleImportPayloadHash(schedules: ValidatedSchedule[]): string {
  const canonical = [...schedules]
    .sort((a, b) => (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0))
    .map((schedule) => ({
      externalId: schedule.externalId,
      title: schedule.title,
      description: schedule.description,
      location: schedule.location,
      note: schedule.note,
      startsAt: schedule.startsAt.toISOString(),
      endsAt: schedule.endsAt.toISOString(),
      status: schedule.status,
    }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

type ExistingRow = {
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
};

type PlannedItem = {
  schedule: ValidatedSchedule;
  action: ImportAction;
  existingId?: string;
  error?: string;
};

function fieldsChanged(existing: ExistingRow, incoming: ValidatedSchedule): boolean {
  return (
    existing.title !== incoming.title ||
    existing.description !== incoming.description ||
    existing.location !== incoming.location ||
    existing.note !== incoming.note ||
    existing.startsAt.getTime() !== incoming.startsAt.getTime() ||
    existing.endsAt.getTime() !== incoming.endsAt.getTime() ||
    existing.status !== incoming.status
  );
}

/**
 * Pure matching step shared by preview and apply. `connectionId` is the
 * scope; rows owned by another scope (including manual null vs a connection
 * id) never match and instead fail the item.
 */
function planImport(connectionId: string | null, schedules: ValidatedSchedule[], existingRows: ExistingRow[]): PlannedItem[] {
  const byExternalId = new Map<string, ExistingRow[]>();
  for (const row of existingRows) {
    const list = byExternalId.get(row.externalId) ?? [];
    list.push(row);
    byExternalId.set(row.externalId, list);
  }

  return schedules.map((schedule) => {
    const rows = byExternalId.get(schedule.externalId) ?? [];
    // At most one row per scope (DB unique index); take the scoped one.
    const owned = rows.find((row) => row.connectionId === connectionId);
    if (owned) {
      if (schedule.status === "cancelled" && owned.status !== "cancelled") {
        // Newly cancelled: update all meaningful fields AND the status.
        return { schedule, action: "cancelled" as const, existingId: owned.id };
      }
      if (fieldsChanged(owned, schedule)) {
        return { schedule, action: "updated" as const, existingId: owned.id };
      }
      return { schedule, action: "unchanged" as const, existingId: owned.id };
    }
    if (rows.length > 0) {
      return {
        schedule,
        action: "failed" as const,
        error: "already owned by another connection",
      };
    }
    // New id — including a payload status of `cancelled`: create it as
    // cancelled so later updates can find it. Counts as `created` (D5).
    return { schedule, action: "created" as const };
  });
}

function summaryFromPlan(plan: PlannedItem[]): ImportSummary {
  const summary: ImportSummary = {
    total: plan.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    cancelled: 0,
    failed: 0,
    items: [],
  };
  for (const item of plan) {
    summary[item.action === "cancelled" ? "cancelled" : item.action] += 1;
    summary.items.push({
      externalId: item.schedule.externalId,
      action: item.action,
      ...(item.error ? { error: item.error } : {}),
    });
  }
  return summary;
}

async function fetchRowsForExternalIds(
  tx: Prisma.TransactionClient,
  externalIds: string[],
): Promise<ExistingRow[]> {
  if (externalIds.length === 0) return [];
  return tx.importedSchedule.findMany({
    where: { externalId: { in: [...new Set(externalIds)] } },
    select: {
      id: true,
      connectionId: true,
      externalId: true,
      title: true,
      description: true,
      location: true,
      note: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });
}

export async function previewScheduleImport(input: {
  connectionId: string | null;
  source: string;
  schedules: ValidatedSchedule[];
}): Promise<ImportSummary> {
  // `source` is accepted for signature symmetry with apply; preview writes
  // nothing, so it is not stored anywhere.
  void input.source;
  const rows = await fetchRowsForExternalIds(prisma, input.schedules.map((s) => s.externalId));
  return summaryFromPlan(planImport(input.connectionId, input.schedules, rows));
}

export async function applyScheduleImport(input: {
  connectionId: string | null;
  source: string;
  schedules: ValidatedSchedule[];
  importKey?: string | null;
  payloadHash: string;
  userId?: string | null;
}): Promise<{ importId: string; summary: ImportSummary }> {
  const importKey = input.importKey ?? null;
  const payloadHash = input.payloadHash || computeScheduleImportPayloadHash(input.schedules);

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.connectionId !== null) {
        const connection = await tx.integrationConnection.findUnique({
          where: { id: input.connectionId },
          select: { id: true },
        });
        if (!connection) throw new IntegrationConnectionNotFoundError(input.connectionId);
      }

      // Idempotency replay (D6): same (connectionId, importKey) + same
      // payloadHash -> return the stored summary, write nothing.
      if (importKey !== null) {
        const existing = await tx.scheduleImport.findFirst({
          where: { connectionId: input.connectionId, importKey },
          include: { items: { orderBy: { externalId: "asc" } } },
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            throw new ImportIdConflictError(importKey);
          }
          return {
            importId: existing.id,
            summary: {
              total: existing.totalRecords,
              created: existing.createdCount,
              updated: existing.updatedCount,
              unchanged: existing.unchangedCount,
              cancelled: existing.cancelledCount,
              failed: existing.failedCount,
              items: existing.items.map((item) => ({
                externalId: item.externalId,
                action: item.action as ImportAction,
                ...(item.error ? { error: item.error } : {}),
              })),
            },
          };
        }
      }

      const rows = await fetchRowsForExternalIds(tx, input.schedules.map((s) => s.externalId));
      const plan = planImport(input.connectionId, input.schedules, rows);

      for (const item of plan) {
        if (item.action === "failed") continue;
        const data = {
          title: item.schedule.title,
          description: item.schedule.description,
          location: item.schedule.location,
          note: item.schedule.note,
          startsAt: item.schedule.startsAt,
          endsAt: item.schedule.endsAt,
          status: item.schedule.status,
        };
        if (item.existingId) {
          // Only the meaningful fields are ever written — nothing
          // server-owned exists on this model, and nothing else is touched.
          await tx.importedSchedule.update({ where: { id: item.existingId }, data });
        } else {
          await tx.importedSchedule.create({
            data: { connectionId: input.connectionId, externalId: item.schedule.externalId, ...data },
          });
        }
      }

      const summary = summaryFromPlan(plan);
      const record = await tx.scheduleImport.create({
        data: {
          connectionId: input.connectionId,
          source: input.source,
          status: summary.failed > 0 ? "completed_with_errors" : "completed",
          totalRecords: summary.total,
          createdCount: summary.created,
          updatedCount: summary.updated,
          unchangedCount: summary.unchanged,
          cancelledCount: summary.cancelled,
          failedCount: summary.failed,
          importKey,
          payloadHash,
          createdByUserId: input.userId ?? null,
        },
        select: { id: true },
      });
      if (summary.items.length > 0) {
        await tx.scheduleImportItem.createMany({
          data: summary.items.map((item) => ({
            importId: record.id,
            externalId: item.externalId,
            action: item.action,
            error: item.error ?? null,
          })),
        });
      }
      return { importId: record.id, summary };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Unique-index race (same externalId / importKey written concurrently).
      // The client retries; retry is safe because apply is record-idempotent.
      throw new ConcurrentImportError();
    }
    throw error;
  }
}
