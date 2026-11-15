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

import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";
import type { ImportedScheduleStatus, ValidatedSchedule } from "@/lib/schedule-import-schema";

export type { ImportedScheduleStatus, ValidatedSchedule } from "@/lib/schedule-import-schema";

export type ImportAction = "created" | "updated" | "unchanged" | "cancelled" | "failed";

/**
 * What happened to the bookable slot for one schedule (Phase 12: an import
 * now also maintains BookingSlot rows for the site's default booking
 * service, so an imported schedule is bookable right away — like the
 * 2026-11-14 demo slots — instead of display-only).
 * - created: a new slot was created at the schedule's time.
 * - moved: the schedule's time moved — the old slot was removed (when it
 *   was free) and the new time is bookable now (created or adopted).
 * - updated: only the end time changed — the slot's endsAt was updated.
 * - removed: the schedule was cancelled/completed — its free slot was deleted.
 * - kept: the slot was deliberately left alone (it already has a booking,
 *   or it was already there and nothing needed writing).
 * - exists: a slot already existed at the schedule's time — adopted, no write.
 * - failed: the slot sync failed for this item (see slotError); the schedule
 *   itself still imported. A slot failure never fails the whole import.
 * - none: no slot sync applies (unchanged schedule, non-bookable status,
 *   failed schedule item, or no active booking service).
 */
export type SlotSyncAction =
  | "created"
  | "moved"
  | "updated"
  | "removed"
  | "kept"
  | "exists"
  | "failed"
  | "none";

export type ImportItemResult = {
  externalId: string;
  action: ImportAction;
  error?: string;
  /** Slot sync outcome for this schedule (Phase 12). Absent = "none". */
  slot?: SlotSyncAction;
  /** Short note when the slot sync failed or kept a booked slot. */
  slotError?: string;
};

export type ImportSummary = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  cancelled: number;
  failed: number;
  items: ImportItemResult[];
  /**
   * The booking service the slots were synced for (Phase 12): the first
   * active service by `order`, the same one the public booking page books.
   * Null when no active service exists — then no slots were synced.
   */
  serviceSlug: string | null;
  /** Aggregate slot-sync outcomes (Phase 12). "exists" counts under kept. */
  slots: {
    created: number;
    moved: number;
    updated: number;
    removed: number;
    kept: number;
    failed: number;
  };
  /** Human-readable note when slot sync was skipped (e.g. no active service). */
  slotsNote?: string;
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
  /** Phase 12 slot sync: planned outcome + execution detail. */
  slot?: SlotSyncAction;
  slotError?: string;
  slotDetail?: {
    /** Slot at the schedule's old time (move / remove / end-time update). */
    oldSlotId?: string;
    oldSlotStatus?: string;
    /** Status for a slot created by this import ("available" | "blocked"). */
    newStatus?: string;
  };
};

type ExistingSlotRow = {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
};

/** A schedule is bookable only while it is scheduled or confirmed. */
function isBookableStatus(status: ImportedScheduleStatus): boolean {
  return status === "scheduled" || status === "confirmed";
}

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

// ---------------------------------------------------------------------------
// Phase 12 — booking-slot sync: an imported schedule also maintains a
// BookingSlot for the site's default booking service (the first active
// service by `order`, the same one the public booking page books), so the
// imported time is bookable right away. A slot failure never fails the
// import: the schedule still imports and the item records a slot error.
// A booked slot is never deleted or retimed — a customer's booking stands.
// ---------------------------------------------------------------------------

type SlotSyncService = { id: string; slug: string };

async function getDefaultBookingService(
  client: Prisma.TransactionClient | PrismaClient,
): Promise<SlotSyncService | null> {
  return client.bookingService.findFirst({
    where: { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true },
  });
}

async function fetchSlotsForStarts(
  client: Prisma.TransactionClient | PrismaClient,
  serviceId: string,
  startsAtList: Date[],
): Promise<ExistingSlotRow[]> {
  if (startsAtList.length === 0) return [];
  return client.bookingSlot.findMany({
    where: { serviceId, startsAt: { in: startsAtList } },
    select: { id: true, status: true, startsAt: true, endsAt: true },
  });
}

function slotForStart(slotsByStart: Map<number, ExistingSlotRow>, startsAt: Date): ExistingSlotRow | undefined {
  return slotsByStart.get(startsAt.getTime());
}

const SLOT_BOOKED_NOTE = "Khung giờ này đã có khách đặt nên được giữ nguyên.";

/**
 * Plans the slot sync for one schedule item, against the slot rows as they
 * are now. Never throws; a "failed" outcome is recorded on the item.
 * `owned` is the schedule row this item matches (undefined for creates).
 */
function planSlotForItem(
  service: SlotSyncService | null,
  item: PlannedItem,
  owned: ExistingRow | undefined,
  slotsByStart: Map<number, ExistingSlotRow>,
): void {
  if (!service || item.action === "failed" || item.action === "unchanged") {
    item.slot = "none";
    return;
  }
  const incoming = item.schedule;
  const newSlot = slotForStart(slotsByStart, incoming.startsAt);

  if (item.action === "created") {
    if (!isBookableStatus(incoming.status)) {
      item.slot = "none";
      return;
    }
    if (newSlot) {
      item.slot = "exists";
      return;
    }
    item.slot = "created";
    item.slotDetail = { newStatus: "available" };
    return;
  }

  if (item.action === "cancelled" || (item.action === "updated" && owned && !isBookableStatus(incoming.status))) {
    if (!owned) {
      item.slot = "none";
      return;
    }
    const oldSlot = slotForStart(slotsByStart, owned.startsAt);
    if (!oldSlot) {
      item.slot = "none";
      return;
    }
    if (oldSlot.status === "booked") {
      item.slot = "kept";
      item.slotError = SLOT_BOOKED_NOTE;
      return;
    }
    item.slot = "removed";
    item.slotDetail = { oldSlotId: oldSlot.id, oldSlotStatus: oldSlot.status };
    return;
  }

  // action === "updated" and still bookable.
  if (!owned) {
    item.slot = "none";
    return;
  }
  const timeChanged = owned.startsAt.getTime() !== incoming.startsAt.getTime();
  const endChanged = owned.endsAt.getTime() !== incoming.endsAt.getTime();
  if (timeChanged) {
    const oldSlot = slotForStart(slotsByStart, owned.startsAt);
    const oldBooked = oldSlot?.status === "booked";
    if (newSlot) {
      // New time already bookable: adopt it; drop the old free slot.
      if (oldSlot && !oldBooked) {
        item.slot = "moved";
        item.slotDetail = { oldSlotId: oldSlot.id, oldSlotStatus: oldSlot.status };
      } else if (oldBooked) {
        item.slot = "moved";
        item.slotError = SLOT_BOOKED_NOTE;
      } else {
        item.slot = "exists";
      }
      return;
    }
    if (oldSlot && !oldBooked) {
      item.slot = "moved";
      item.slotDetail = {
        oldSlotId: oldSlot.id,
        oldSlotStatus: oldSlot.status,
        newStatus: oldSlot.status,
      };
      return;
    }
    if (oldBooked) {
      item.slot = "created";
      item.slotDetail = { newStatus: "available" };
      item.slotError = SLOT_BOOKED_NOTE;
      return;
    }
    item.slot = "created";
    item.slotDetail = { newStatus: "available" };
    return;
  }
  if (endChanged) {
    const slot = slotForStart(slotsByStart, owned.startsAt);
    if (!slot) {
      item.slot = "created";
      item.slotDetail = { newStatus: "available" };
      return;
    }
    if (slot.status === "booked") {
      item.slot = "kept";
      item.slotError = "Khung giờ này đã có khách đặt nên giữ nguyên giờ kết thúc cũ.";
      return;
    }
    item.slot = "updated";
    item.slotDetail = { oldSlotId: slot.id, oldSlotStatus: slot.status };
    return;
  }
  item.slot = "none";
}

/**
 * Fills in the slot plan for every item. `existingRows` are the schedule
 * rows the plan matched against (same input as planImport).
 */
function planSlotSync(
  service: SlotSyncService | null,
  plan: PlannedItem[],
  existingRows: ExistingRow[],
  slots: ExistingSlotRow[],
): void {
  const slotsByStart = new Map(slots.map((slot) => [slot.startsAt.getTime(), slot]));
  const ownedByItemId = new Map(existingRows.map((row) => [row.id, row]));
  for (const item of plan) {
    const owned = item.existingId ? ownedByItemId.get(item.existingId) : undefined;
    planSlotForItem(service, item, owned, slotsByStart);
  }
}

/**
 * Executes the slot plan inside the apply transaction. Two phases so a
 * time-swap inside one payload cannot collide on the unique
 * [serviceId, startsAt] key: phase 1 removes old slots, phase 2 creates or
 * updates. Every write is conditional (status-guarded) or P2002-guarded,
 * so a concurrent booking claim turns the item into "kept"/"exists"
 * instead of failing the import. Never throws.
 */
async function executeSlotSync(
  tx: Prisma.TransactionClient,
  service: SlotSyncService,
  plan: PlannedItem[],
): Promise<void> {
  // Phase 1 — remove old slots for moved / removed items (free slots only).
  for (const item of plan) {
    const oldSlotId = item.slotDetail?.oldSlotId;
    if (!oldSlotId) continue;
    if (item.slot !== "moved" && item.slot !== "removed") continue;
    try {
      const deleted = await tx.bookingSlot.deleteMany({
        where: { id: oldSlotId, status: { in: ["available", "blocked"] } },
      });
      if (deleted.count === 0) {
        item.slot = "kept";
        item.slotError = SLOT_BOOKED_NOTE;
      }
    } catch {
      item.slot = "failed";
      item.slotError = "Không thể dời khung giờ cũ.";
    }
  }

  // Phase 2 — create new slots / update end times.
  for (const item of plan) {
    if (item.slot !== "created" && item.slot !== "moved" && item.slot !== "updated") continue;
    try {
      if (item.slot === "updated" && item.slotDetail?.oldSlotId) {
        const updated = await tx.bookingSlot.updateMany({
          where: { id: item.slotDetail.oldSlotId, status: { in: ["available", "blocked"] } },
          data: { endsAt: item.schedule.endsAt },
        });
        if (updated.count === 0) {
          item.slot = "kept";
          item.slotError = "Khung giờ này đã có khách đặt nên giữ nguyên giờ kết thúc cũ.";
        }
        continue;
      }
      const existing = await tx.bookingSlot.findFirst({
        where: { serviceId: service.id, startsAt: item.schedule.startsAt },
        select: { id: true, status: true },
      });
      if (existing) {
        // Adopted: a slot is already there (manual or concurrent import).
        if (item.slot === "created") item.slot = "exists";
        continue;
      }
      await tx.bookingSlot.create({
        data: {
          serviceId: service.id,
          startsAt: item.schedule.startsAt,
          endsAt: item.schedule.endsAt,
          status: item.slotDetail?.newStatus ?? "available",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Lost a race: a slot is there now — adopt it.
        if (item.slot === "created") item.slot = "exists";
      } else {
        item.slot = "failed";
        item.slotError = "Không thể tạo khung giờ đặt lịch.";
      }
    }
  }
}

function slotCountsFromItems(items: { slot?: SlotSyncAction }[]): ImportSummary["slots"] {
  const slots: ImportSummary["slots"] = { created: 0, moved: 0, updated: 0, removed: 0, kept: 0, failed: 0 };
  for (const item of items) {
    if (item.slot === "created") slots.created += 1;
    else if (item.slot === "moved") slots.moved += 1;
    else if (item.slot === "updated") slots.updated += 1;
    else if (item.slot === "removed") slots.removed += 1;
    else if (item.slot === "kept" || item.slot === "exists") slots.kept += 1;
    else if (item.slot === "failed") slots.failed += 1;
  }
  return slots;
}

function summaryFromPlan(
  plan: PlannedItem[],
  serviceSlug: string | null,
  slotsNote?: string,
): ImportSummary {
  const summary: ImportSummary = {
    total: plan.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    cancelled: 0,
    failed: 0,
    items: [],
    serviceSlug,
    slots: slotCountsFromItems(plan),
    ...(slotsNote ? { slotsNote } : {}),
  };
  for (const item of plan) {
    summary[item.action === "cancelled" ? "cancelled" : item.action] += 1;
    summary.items.push({
      externalId: item.schedule.externalId,
      action: item.action,
      ...(item.error ? { error: item.error } : {}),
      ...(item.slot && item.slot !== "none" ? { slot: item.slot } : {}),
      ...(item.slotError ? { slotError: item.slotError } : {}),
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

/**
 * Every startsAt the slot planner may need: each incoming time plus the
 * current time of every schedule this import matches (for moves/cancels).
 */
function relevantStarts(plan: PlannedItem[], rows: ExistingRow[]): Date[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<number>();
  const out: Date[] = [];
  const add = (date: Date) => {
    if (!seen.has(date.getTime())) {
      seen.add(date.getTime());
      out.push(date);
    }
  };
  for (const item of plan) {
    add(item.schedule.startsAt);
    const owned = item.existingId ? byId.get(item.existingId) : undefined;
    if (owned) add(owned.startsAt);
  }
  return out;
}

const NO_SERVICE_SLOTS_NOTE = "Không có dịch vụ đặt lịch đang hoạt động — không tạo khung giờ.";

export async function previewScheduleImport(input: {
  connectionId: string | null;
  source: string;
  schedules: ValidatedSchedule[];
}): Promise<ImportSummary> {
  // `source` is accepted for signature symmetry with apply; preview writes
  // nothing, so it is not stored anywhere.
  void input.source;
  const rows = await fetchRowsForExternalIds(prisma, input.schedules.map((s) => s.externalId));
  const plan = planImport(input.connectionId, input.schedules, rows);
  const service = await getDefaultBookingService(prisma);
  const slots = service ? await fetchSlotsForStarts(prisma, service.id, relevantStarts(plan, rows)) : [];
  planSlotSync(service, plan, rows, slots);
  return summaryFromPlan(plan, service?.slug ?? null, service ? undefined : NO_SERVICE_SLOTS_NOTE);
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
          // Phase 12: slot outcomes are not stored on ScheduleImport, so a
          // replay recomputes the CURRENT slot state (are these times
          // bookable right now?) instead of returning the first run's.
          const replayService = await getDefaultBookingService(tx);
          const replayRows = await fetchRowsForExternalIds(
            tx,
            existing.items.map((item) => item.externalId),
          );
          const scopedRows = replayRows.filter((row) => row.connectionId === input.connectionId);
          const replaySlots = replayService
            ? await fetchSlotsForStarts(tx, replayService.id, scopedRows.map((row) => row.startsAt))
            : [];
          const replaySlotsByStart = new Map(replaySlots.map((slot) => [slot.startsAt.getTime(), slot]));
          const replayItems: ImportItemResult[] = existing.items.map((stored) => {
            const row = scopedRows.find((candidate) => candidate.externalId === stored.externalId);
            let slot: SlotSyncAction | undefined;
            if (replayService && row && isBookableStatus(row.status as ImportedScheduleStatus)) {
              const slotRow = replaySlotsByStart.get(row.startsAt.getTime());
              if (slotRow) slot = slotRow.status === "booked" ? "kept" : "exists";
            }
            return {
              externalId: stored.externalId,
              action: stored.action as ImportAction,
              ...(stored.error ? { error: stored.error } : {}),
              ...(slot ? { slot } : {}),
            };
          });
          return {
            importId: existing.id,
            summary: {
              total: existing.totalRecords,
              created: existing.createdCount,
              updated: existing.updatedCount,
              unchanged: existing.unchangedCount,
              cancelled: existing.cancelledCount,
              failed: existing.failedCount,
              items: replayItems,
              serviceSlug: replayService?.slug ?? null,
              slots: slotCountsFromItems(replayItems),
              ...(replayService ? {} : { slotsNote: NO_SERVICE_SLOTS_NOTE }),
            },
          };
        }
      }

      const rows = await fetchRowsForExternalIds(tx, input.schedules.map((s) => s.externalId));
      const plan = planImport(input.connectionId, input.schedules, rows);
      const service = await getDefaultBookingService(tx);
      const slots = service ? await fetchSlotsForStarts(tx, service.id, relevantStarts(plan, rows)) : [];
      planSlotSync(service, plan, rows, slots);

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

      // Phase 12: sync the booking slots for the planned schedules, in the
      // same transaction. A slot failure never fails the import (the
      // executor records it on the item instead of throwing).
      if (service) {
        await executeSlotSync(tx, service, plan);
      }

      const summary = summaryFromPlan(plan, service?.slug ?? null, service ? undefined : NO_SERVICE_SLOTS_NOTE);
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
